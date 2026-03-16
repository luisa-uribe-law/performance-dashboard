import { DeveloperMonthly, IntegrationTicket, BugTicket, OnCallTicket, Squad, MonthlyTeamMetrics, OnCallPriorityMetrics, BugSlaMetrics, BugSlaPriorityMetrics, PriorityLabel } from "./types";

// ── Config (read lazily so env vars are available at request time, not build time) ──
function getJiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL || "https://yunopayments.atlassian.net";
  const email = process.env.JIRA_EMAIL || "";
  const token = process.env.JIRA_API_TOKEN || "";
  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  return { baseUrl, auth };
}

// ── Developer roster (loaded from JSON file, server-only) ──
interface RosterEntry {
  displayName: string;
  jiraNames: string[];
  email: string;
  github: string;
  group: Squad;
  role?: string;
  active: boolean;
  activeFrom?: string;
  activeTo?: string;
}

function loadRoster(): RosterEntry[] {
  // Dynamic require to avoid bundling fs in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const rosterPath = path.join(process.cwd(), "data/roster.json");
  const raw = fs.readFileSync(rosterPath, "utf-8");
  return JSON.parse(raw);
}

// Known providers for weight determination
const KNOWN_PROVIDERS = new Set([
  "stripe", "adyen", "dlocal", "payu", "mercadopago", "nuvei", "conekta", "cybersource",
  "worldpay", "paypal", "kushki", "pagseguro", "wompi", "redeban", "prosa", "ecommpay",
  "ipsp", "flutterwave", "starkbank", "tap", "signifyd", "zesta", "beyondone", "bamboo",
  "checkout.com", "rapyd", "fiserv", "ingenico", "moneris", "paysafe", "braintree",
  "transbank", "shopfacil", "redsys", "unlimint", "braintree", "ecommpay",
]);

// ── Jira API helpers ──

interface JiraIssue {
  id: string;
  key?: string;
  fields: Record<string, unknown>;
}

async function jiraSearchAll(jql: string, fields: string): Promise<JiraIssue[]> {
  const { baseUrl, auth } = getJiraConfig();
  const all: JiraIssue[] = [];
  let nextToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({ jql, maxResults: "100", fields });
    if (nextToken) params.set("nextPageToken", nextToken);

    const url = `${baseUrl}/rest/api/3/search/jql?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Jira API ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = await resp.json() as { issues: JiraIssue[]; isLast?: boolean; nextPageToken?: string };
    all.push(...data.issues);

    if (data.isLast !== false) break;
    nextToken = data.nextPageToken;
    if (!nextToken) break;
  }

  return all;
}

function getField(issue: JiraIssue, field: string): unknown {
  return issue.fields[field];
}

function getFieldStr(issue: JiraIssue, field: string): string {
  const v = issue.fields[field];
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) return (v as { name: string }).name;
  if (v && typeof v === "object" && "value" in v) return (v as { value: string }).value;
  return "";
}

function getAssigneeName(issue: JiraIssue): string {
  const a = issue.fields.assignee as { displayName?: string } | null;
  return a?.displayName || "Unassigned";
}

function getIssueKey(issue: JiraIssue): string {
  return issue.key || issue.id;
}

// Jira returns dates like "2026-02-26T18:54:37.208-0500"
function parseJiraDate(s: string): Date {
  const fixed = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return new Date(fixed);
}

// ── Roster matching ──

function resolveJiraName(jiraDisplayName: string): RosterEntry | undefined {
  const lower = jiraDisplayName.toLowerCase();
  return loadRoster().find(r => r.jiraNames.some(n => n.toLowerCase() === lower));
}

function getActiveRoster(month: string): RosterEntry[] {
  return loadRoster().filter(r => {
    if (r.activeFrom && month < r.activeFrom) return false;
    if (r.activeTo && month > r.activeTo) return false;
    return true;
  });
}

// ── Data fetching ──

async function fetchDemTasks(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // Fetch tasks that reached Done/Implementation Complete during the period.
  // We do NOT require the ticket to still be in that status — tickets often move
  // forward to "Ready for Release" after completion. The DURING clause confirms
  // they passed through Done/IC, and completedInMonth() filters by actual date.
  const epics = await jiraSearchAll(
    `project = DEM AND issuetype = Epic AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,statuscategorychangedate"
  );

  const stories = await jiraSearchAll(
    `project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,parent,statuscategorychangedate"
  );

  const validStories = stories.filter(s => {
    const summary = getFieldStr(s, "summary").toLowerCase();
    return !summary.includes("dev validation");
  });

  const techDebt = await jiraSearchAll(
    `project = DEM AND issuetype = "Tech Debt" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,statuscategorychangedate"
  );

  return [...epics, ...validStories, ...techDebt];
}

async function fetchYshubTickets(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // Fetch tickets that reached Done/Resolved/Closed/Deployment in Queue (excludes Canceled) — used for developer-level metrics
  // "Deployment in Queue" is the definition of done for SLA and resolution time purposes
  return jiraSearchAll(
    `project = YSHUB AND component = Integration AND status changed to (Done, Resolved, Closed, "Deployment in Queue") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,priority,created,resolutiondate,statuscategorychangedate,customfield_10074,customfield_10229,customfield_10196,issuetype"
  );
}

async function fetchYshubAllClosed(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // Fetch ALL tickets closed during the period (including Canceled and Bug types) — used for team-level totals
  // "Deployment in Queue" is the definition of done for SLA and resolution time purposes
  return jiraSearchAll(
    `project = YSHUB AND component = Integration AND status changed to (Done, Resolved, Closed, Canceled, "Deployment in Queue") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,priority,created,resolutiondate,statuscategorychangedate,customfield_10074,customfield_10229,customfield_10196,issuetype"
  );
}

async function fetchYshubBugsForSla(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // Bug-type tickets closed during the period — used for bugs-only SLA analysis
  return jiraSearchAll(
    `project = YSHUB AND issuetype = Bug AND component = Integration AND status changed to (Done, Resolved, Closed, "Deployment in Queue") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,priority,created,resolutiondate,statuscategorychangedate,customfield_10074,customfield_10196,reporter"
  );
}

async function fetchSbxBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  return jiraSearchAll(
    `project = DEM AND issuetype = "In-Sprint Bug" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,parent"
  );
}

async function fetchProdBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // YSHUB bugs with "Responsible Party of the Bug" (customfield_14104) filled
  return jiraSearchAll(
    `project = YSHUB AND component = Integration AND status changed to (Done, Resolved, Closed) DURING ("${startDate}", "${endDate}") AND cf[14104] is not EMPTY`,
    "summary,assignee,priority,customfield_14104,customfield_11877"
  );
}

async function fetchYshubBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // ONLY Bug-type issues from YSHUB, with Provider, Environment, and Responsible Party fields
  return jiraSearchAll(
    `project = YSHUB AND issuetype = Bug AND component = Integration AND created >= "${startDate}" AND created <= "${endDate}"`,
    "summary,priority,status,customfield_10229,customfield_10196,customfield_14104,customfield_11877,issuetype"
  );
}

// ── Weight determination (Tasks at Hand framework) ──

function determineWeight(issue: JiraIssue): number {
  const summary = getFieldStr(issue, "summary").toLowerCase();
  const issueType = (getField(issue, "issuetype") as { name?: string })?.name || "";

  // Weight 1: Tech Debt
  if (issueType.toLowerCase().includes("tech debt")) return 1;

  // Weight 7: ISO Integration (BBVA, Diners, JP Morgan type)
  if (/\b(bbva|diners|jp\s*morgan|iso\s*integration)\b/i.test(summary)) return 7;

  const isNew = /new\s+integration/i.test(summary);
  const hasCard = /\bcard/i.test(summary);
  const hasApm = /\b(apm|pix|pse|oxxo|boleto|bank.?transfer|wallet|qr|crypto|upi|sbp)\b/i.test(summary);
  const paymentMethodMatches = (summary.match(/\b(card|pix|pse|oxxo|boleto|wallet|qr|crypto|upi|sbp|apm)\b/gi) || []);
  const multiplePaymentMethods = (hasCard && hasApm) || paymentMethodMatches.length > 2;

  if (isNew) {
    // Weight 6: New Integration — Multiple payment methods
    if (multiplePaymentMethods) return 6;
    // Weight 5: New Integration — APM
    if (hasApm) return 5;
    // Weight 4: New Integration — Cards only
    return 4;
  }

  // Weight 3: APM from existing provider
  if (hasApm) return 3;
  // Weight 2: Card integration from existing provider
  if (hasCard) return 2;

  // Fallback: references a known provider = existing provider work
  const referencesProvider = [...KNOWN_PROVIDERS].some(p => summary.includes(p));
  if (referencesProvider) return 2;

  return 1;
}

// ── OTD calculation ──

function wasOnTime(issue: JiraIssue): boolean | null {
  const dueDate = getFieldStr(issue, "duedate");
  if (!dueDate) return null;

  const completedDate = getFieldStr(issue, "statuscategorychangedate")
    || getFieldStr(issue, "resolutiondate");
  if (!completedDate) return null;

  const due = new Date(dueDate + "T23:59:59");
  const completed = parseJiraDate(completedDate);
  return completed <= due;
}

// ── SLA from Jira's built-in SLA field (customfield_10074) ──
// Falls back to computing from created → statuscategorychangedate when no SLA cycle exists

interface SlaData {
  breached: boolean;
  elapsedMs: number;
  goalMs: number;
  computed: boolean; // true if SLA was computed from dates (no Jira SLA cycle)
}

// SLA goals by priority (from Jira Service Management configuration)
const SLA_GOAL_MS: Record<string, number> = {
  Highest: 72 * 3600000,  // 72h
  High: 48 * 3600000,     // 48h
  Medium: 72 * 3600000,   // 72h
  Low: 120 * 3600000,     // 120h
};

function extractSla(issue: JiraIssue): SlaData | null {
  const sla = getField(issue, "customfield_10074") as {
    completedCycles?: Array<{
      breached?: boolean;
      elapsedTime?: { millis?: number };
      goalDuration?: { millis?: number };
    }>;
  } | null;

  // Use Jira's SLA data if available
  if (sla?.completedCycles?.length) {
    const cycle = sla.completedCycles[0];
    return {
      breached: cycle.breached ?? false,
      elapsedMs: cycle.elapsedTime?.millis ?? 0,
      goalMs: cycle.goalDuration?.millis ?? 0,
      computed: false,
    };
  }

  // Fallback: compute from created → statuscategorychangedate
  const createdStr = getFieldStr(issue, "created");
  const closedStr = getFieldStr(issue, "statuscategorychangedate");
  if (!createdStr || !closedStr) return null;

  const created = parseJiraDate(createdStr);
  const closed = parseJiraDate(closedStr);
  const elapsedMs = closed.getTime() - created.getTime();
  if (elapsedMs < 0) return null;

  const priority = (getField(issue, "priority") as { name?: string })?.name || "Low";
  const goalMs = SLA_GOAL_MS[priority] || SLA_GOAL_MS.Low;

  return {
    breached: elapsedMs > goalMs,
    elapsedMs,
    goalMs,
    computed: true,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Responsible Party extraction ──

function getResponsibleParty(issue: JiraIssue): string | null {
  const rp = getField(issue, "customfield_14104") as { displayName?: string; value?: string; name?: string } | null;
  if (!rp) return null;
  return rp.displayName || rp.value || rp.name || null;
}

// ── Provider and Environment extraction from YSHUB fields ──

function getBugProvider(issue: JiraIssue): string {
  const provider = getField(issue, "customfield_10229") as { value?: string } | null;
  return provider?.value || "Unknown";
}

function getReportingType(issue: JiraIssue): "Merchant" | "Team" | "Unknown" {
  const rt = getField(issue, "customfield_11877") as { value?: string } | null;
  if (!rt?.value) return "Unknown";
  if (rt.value === "Merchant") return "Merchant";
  if (rt.value === "Team") return "Team";
  return "Unknown";
}

function getBugEnvironment(issue: JiraIssue): "PROD" | "SBX" | "STG" {
  const envField = getField(issue, "customfield_10196") as Array<{ value?: string }> | null;
  if (!envField || envField.length === 0) return "PROD"; // default if not set
  const values = envField.map(e => (e.value || "").toLowerCase());
  if (values.some(v => v.includes("production") || v.includes("prod"))) return "PROD";
  if (values.some(v => v.includes("staging") || v.includes("stg"))) return "STG";
  if (values.some(v => v.includes("sandbox") || v.includes("sbx") || v.includes("dev"))) return "SBX";
  return "PROD"; // fallback
}

// ── Reporter helpers for bug SLA filtering ──

function getReporterName(issue: JiraIssue): string {
  const r = issue.fields.reporter as { displayName?: string } | null;
  return r?.displayName || "Unknown";
}

function isInternalReporter(reporterName: string, roster: RosterEntry[]): boolean {
  const lower = reporterName.toLowerCase();
  if (lower === "on call guardian" || lower === "atlassian assist") return true;
  return roster.some(r =>
    r.displayName.toLowerCase() === lower ||
    r.jiraNames.some(jn => jn.toLowerCase() === lower)
  );
}

function getBugEnvRaw(issue: JiraIssue): string {
  const envField = getField(issue, "customfield_10196") as Array<{ value?: string }> | null;
  if (!envField || envField.length === 0) return "production";
  return envField.map(e => (e.value || "").toLowerCase()).join(",");
}

function isBugProd(issue: JiraIssue): boolean {
  const env = getBugEnvRaw(issue);
  return env.includes("production") || env.includes("prod") || env.includes("all");
}

// ── Main sync function ──

export interface SyncResult {
  month: string;
  teamMetrics: MonthlyTeamMetrics;
  developerMetrics: DeveloperMonthly[];
  onCallPriority: OnCallPriorityMetrics[];
  bugSla: BugSlaMetrics;
  yshubBugs: BugTicket[];
  debug?: {
    totalDemRaw: number;
    totalYshubRaw: number;
    totalYshubAllClosed: number;
    totalSbxBugsRaw: number;
    totalProdBugsRaw: number;
    totalYshubBugsRaw: number;
    unmatchedYshub: number;
    unmatchedDem: number;
  };
}

export async function syncMonth(month: string): Promise<SyncResult> {
  const [year, m] = month.split("-");
  const startDate = `${year}-${m}-01`;
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
  const endDate = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;

  const [demTasks, yshubTickets, yshubAllClosed, yshubBugsForSla, sbxBugsRaw, prodBugsRaw, yshubBugsRaw] = await Promise.all([
    fetchDemTasks(startDate, endDate),
    fetchYshubTickets(startDate, endDate),
    fetchYshubAllClosed(startDate, endDate),
    fetchYshubBugsForSla(startDate, endDate),
    fetchSbxBugs(startDate, endDate),
    fetchProdBugs(startDate, endDate),
    fetchYshubBugs(startDate, endDate),
  ]);

  const roster = getActiveRoster(month);

  // ── Group by developer ──
  const devData: Record<string, {
    demTasks: JiraIssue[];
    yshubTickets: JiraIssue[];
    sbxBugs: JiraIssue[];
    prodBugs: JiraIssue[];
    yshubBugsByRP: JiraIssue[];  // YSHUB Bug-type issues where dev is Responsible Party
  }> = {};

  for (const entry of roster) {
    devData[entry.displayName] = { demTasks: [], yshubTickets: [], sbxBugs: [], prodBugs: [], yshubBugsByRP: [] };
  }

  // Helper: check if the ticket's actual completion date falls within the requested month.
  // The DURING clause can return tickets whose statuscategorychangedate is outside the month.
  function completedInMonth(issue: JiraIssue): boolean {
    const raw = getFieldStr(issue, "statuscategorychangedate") || getFieldStr(issue, "resolutiondate");
    if (!raw) return true; // no date available, keep it
    const completedMonth = parseJiraDate(raw).toISOString().slice(0, 7); // "2026-02"
    return completedMonth === month;
  }

  let unmatchedDem = 0;
  for (const issue of demTasks) {
    if (!completedInMonth(issue)) continue;
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].demTasks.push(issue);
    } else {
      unmatchedDem++;
    }
  }

  let unmatchedYshub = 0;
  for (const issue of yshubTickets) {
    if (!completedInMonth(issue)) continue;
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].yshubTickets.push(issue);
    } else {
      unmatchedYshub++;
    }
  }

  // SBX bugs: only count those assigned to roster members
  for (const issue of sbxBugsRaw) {
    if (!completedInMonth(issue)) continue;
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].sbxBugs.push(issue);
    }
  }

  // PROD bugs count: from YSHUB tickets with Responsible Party (any type, for KPI count)
  let totalProdBugs = 0;
  for (const issue of prodBugsRaw) {
    if (!completedInMonth(issue)) continue;
    const responsibleName = getResponsibleParty(issue);
    if (!responsibleName) continue;
    const entry = resolveJiraName(responsibleName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].prodBugs.push(issue);
      totalProdBugs++;
    }
  }

  // YSHUB Bug-type issues: match to developers by Responsible Party
  for (const issue of yshubBugsRaw) {
    const responsibleName = getResponsibleParty(issue);
    if (!responsibleName) continue;
    const entry = resolveJiraName(responsibleName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].yshubBugsByRP.push(issue);
    }
  }

  // ── Build developer metrics ──
  const developerMetrics: DeveloperMonthly[] = [];
  let totalTasks = 0;
  let totalSbxBugs = 0;
  let otdNumerator = 0;
  let otdDenominator = 0;
  let activeDevelopers = 0;

  for (const entry of roster) {
    const dd = devData[entry.displayName];
    if (!dd) continue;

    const taskCount = dd.demTasks.length;
    const yshubCount = dd.yshubTickets.length;
    const sbxCount = dd.sbxBugs.length;

    // Weight: only DEM tasks use Tasks at Hand framework
    const weightedTasks = dd.demTasks.reduce((sum, t) => sum + determineWeight(t), 0);

    // OTD
    let onTimePct = 0;
    if (taskCount > 0) {
      const otdResults = dd.demTasks.map(wasOnTime).filter((v): v is boolean => v !== null);
      if (otdResults.length > 0) {
        onTimePct = Math.round((otdResults.filter(v => v === true).length / otdResults.length) * 100);
      }
    }

    // SLA from Jira's built-in SLA field
    let slaOk = 0;
    let slaTotal = 0;
    const resolutionHours: number[] = [];

    for (const ticket of dd.yshubTickets) {
      const sla = extractSla(ticket);
      if (sla) {
        slaTotal++;
        if (!sla.breached) slaOk++;
        resolutionHours.push(sla.elapsedMs / (1000 * 60 * 60));
      }
    }

    const slaPct = slaTotal > 0 ? Math.round((slaOk / slaTotal) * 1000) / 10 : 0;
    const medianHrs = Math.round(median(resolutionHours) * 10) / 10;

    const integrations: IntegrationTicket[] = dd.demTasks.map(t => {
      const cd = getFieldStr(t, "statuscategorychangedate") || getFieldStr(t, "resolutiondate");
      return {
        key: getIssueKey(t),
        summary: getFieldStr(t, "summary"),
        weightedTasks: determineWeight(t),
        onTime: wasOnTime(t) ?? false,
        closedDate: cd ? parseJiraDate(cd).toISOString().slice(0, 10) : null,
      };
    });

    const onCallTickets: OnCallTicket[] = dd.yshubTickets.map(t => {
      const sla = extractSla(t);
      const cd = getFieldStr(t, "statuscategorychangedate") || getFieldStr(t, "resolutiondate");
      return {
        key: getIssueKey(t),
        summary: getFieldStr(t, "summary"),
        priority: (getField(t, "priority") as { name?: string })?.name || "Unknown",
        slaBreached: sla ? sla.breached : false,
        resolutionHrs: sla ? Math.round(sla.elapsedMs / (1000 * 60 * 60) * 10) / 10 : null,
        closedDate: cd ? parseJiraDate(cd).toISOString().slice(0, 10) : null,
      };
    });

    // Per-developer bugs: DEM In-Sprint Bugs (assigned) + YSHUB Bug-type (by Responsible Party)
    const bugs: BugTicket[] = [
      ...dd.sbxBugs.map(b => ({
        key: getIssueKey(b),
        summary: getFieldStr(b, "summary"),
        env: "SBX" as const,
        provider: "",
        source: "DEM" as const,
        reportingType: "Team" as const,
      })),
      ...dd.yshubBugsByRP.map(b => ({
        key: getIssueKey(b),
        summary: getFieldStr(b, "summary"),
        env: getBugEnvironment(b),
        provider: getBugProvider(b),
        source: "YSHUB" as const,
        reportingType: getReportingType(b),
      })),
    ];

    const isActive = taskCount > 0 || yshubCount > 0;
    if (isActive) activeDevelopers++;

    totalTasks += taskCount;
    totalSbxBugs += sbxCount;
    if (taskCount > 0) {
      otdDenominator++;
      otdNumerator += onTimePct;
    }

    developerMetrics.push({
      developer: entry.displayName,
      month,
      group: entry.group,
      role: entry.role,
      deactivated: !entry.active,
      tasksCompleted: taskCount,
      weightedTasks: Math.round(weightedTasks),
      onTimeDeliveryPct: onTimePct,
      prodBugs: dd.prodBugs.length,
      sbxBugs: sbxCount,
      ticketsResolved: yshubCount,
      medianResolutionHrs: medianHrs,
      slaCompliancePct: slaPct,
      integrations,
      bugs,
      onCallTickets,
    });
  }

  // ── YSHUB Bug-type issues (project-wide, grouped by provider/env) ──
  // Filter to only bugs whose completion date matches the requested month
  const filteredYshubBugsRaw = yshubBugsRaw.filter(completedInMonth);
  const yshubBugs: BugTicket[] = filteredYshubBugsRaw.map(b => ({
    key: getIssueKey(b),
    summary: getFieldStr(b, "summary"),
    env: getBugEnvironment(b),
    provider: getBugProvider(b),
    source: "YSHUB" as const,
    reportingType: getReportingType(b),
  }));

  // ── On-Call priority breakdown (uses all closed tickets for team-level view) ──
  // Filter to only tickets whose completion date matches the requested month
  const filteredYshubAllClosed = yshubAllClosed.filter(completedInMonth);
  const byPriority: Record<string, JiraIssue[]> = {};
  for (const t of filteredYshubAllClosed) {
    const p = (getField(t, "priority") as { name?: string })?.name || "Low";
    if (!byPriority[p]) byPriority[p] = [];
    byPriority[p].push(t);
  }

  const priorityOrder: PriorityLabel[] = ["Highest", "High", "Medium", "Low"];
  const onCallPriority: OnCallPriorityMetrics[] = priorityOrder.map(p => {
    const tickets = byPriority[p] || [];
    const hours: number[] = [];
    let slaOk = 0;
    let slaTotal = 0;
    for (const t of tickets) {
      const sla = extractSla(t);
      if (sla) {
        slaTotal++;
        if (!sla.breached) slaOk++;
        hours.push(sla.elapsedMs / (1000 * 60 * 60));
      }
    }
    return {
      month,
      priority: p,
      medianResolutionHrs: Math.round(median(hours) * 10) / 10,
      slaCompliancePct: slaTotal > 0 ? Math.round((slaOk / slaTotal) * 1000) / 10 : 0,
    };
  });

  // ── Team metrics (use yshubAllClosed for totals — includes Canceled + Bug types) ──
  const allHours: number[] = [];
  let teamSlaOk = 0;
  let teamSlaTotal = 0;
  // SLA and resolution metrics still computed from non-canceled tickets only (meaningful metrics)
  for (const t of yshubTickets) {
    const sla = extractSla(t);
    if (sla) {
      teamSlaTotal++;
      if (!sla.breached) teamSlaOk++;
      allHours.push(sla.elapsedMs / (1000 * 60 * 60));
    }
  }

  // ── PROD bug reporting type counts (only bugs attributed to team via Responsible Party) ──
  let yshubBugsMerchant = 0;
  let yshubBugsTeam = 0;
  let yshubBugsUnknown = 0;
  for (const issue of prodBugsRaw) {
    if (!completedInMonth(issue)) continue;
    const responsibleName = getResponsibleParty(issue);
    if (!responsibleName) continue;
    const entry = resolveJiraName(responsibleName);
    if (!entry || !devData[entry.displayName]) continue; // only count if attributed to a roster member
    const rt = getReportingType(issue);
    if (rt === "Merchant") yshubBugsMerchant++;
    else if (rt === "Team") yshubBugsTeam++;
    else yshubBugsUnknown++;
  }

  const teamMetrics: MonthlyTeamMetrics = {
    month,
    tasksCompleted: totalTasks,
    tasksPerDeveloper: activeDevelopers > 0 ? Math.round((totalTasks / activeDevelopers) * 10) / 10 : 0,
    onTimeDeliveryPct: otdDenominator > 0 ? Math.round(otdNumerator / otdDenominator) : 0,
    prodBugs: totalProdBugs,
    sbxBugs: totalSbxBugs,
    yshubBugsMerchant,
    yshubBugsTeam,
    yshubBugsUnknown,
    ticketsResolved: filteredYshubAllClosed.length, // All YSHUB tickets closed (incl. Canceled + Bugs)
    slaCompliancePct: teamSlaTotal > 0 ? Math.round((teamSlaOk / teamSlaTotal) * 1000) / 10 : 0,
    medianResolutionDays: allHours.length > 0 ? Math.round(median(allHours) / 24 * 10) / 10 : 0,
    activeDevelopers,
  };

  // ── Bug-only SLA analysis ──
  // Qualifying: Production bugs (any reporter) + non-production bugs (only external reporters)
  const filteredYshubBugsForSla = yshubBugsForSla.filter(completedInMonth);
  const qualifyingBugs = filteredYshubBugsForSla.filter(issue => {
    if (isBugProd(issue)) return true; // Production: all reporters
    const reporter = getReporterName(issue);
    return !isInternalReporter(reporter, roster); // Non-prod: only external (merchant/company)
  });

  const bugSlaByPriority: Record<string, { ok: number; total: number; hours: number[] }> = {};
  const priorityOrderForBugs: PriorityLabel[] = ["Highest", "High", "Medium", "Low"];
  for (const p of priorityOrderForBugs) bugSlaByPriority[p] = { ok: 0, total: 0, hours: [] };

  let bugSlaOk = 0;
  let bugSlaTotal = 0;
  const bugAllHours: number[] = [];

  for (const issue of qualifyingBugs) {
    const sla = extractSla(issue);
    if (!sla) continue;
    const hrs = sla.elapsedMs / (1000 * 60 * 60);
    bugSlaTotal++;
    bugAllHours.push(hrs);
    if (!sla.breached) bugSlaOk++;

    const prio = (getField(issue, "priority") as { name?: string })?.name || "Low";
    const bucket = bugSlaByPriority[prio] || bugSlaByPriority.Low;
    bucket.total++;
    bucket.hours.push(hrs);
    if (!sla.breached) bucket.ok++;
  }

  const bugSla: BugSlaMetrics = {
    month,
    totalBugs: qualifyingBugs.length,
    overallSlaPct: bugSlaTotal > 0 ? Math.round((bugSlaOk / bugSlaTotal) * 1000) / 10 : 0,
    medianResolutionHrs: bugAllHours.length > 0 ? Math.round(median(bugAllHours) * 10) / 10 : 0,
    byPriority: priorityOrderForBugs.map(p => {
      const b = bugSlaByPriority[p];
      return {
        month,
        priority: p,
        count: b.total,
        slaCompliancePct: b.total > 0 ? Math.round((b.ok / b.total) * 1000) / 10 : 0,
        medianResolutionHrs: b.hours.length > 0 ? Math.round(median(b.hours) * 10) / 10 : 0,
      };
    }),
  };

  return {
    month,
    teamMetrics,
    developerMetrics,
    onCallPriority,
    bugSla,
    yshubBugs,
    debug: {
      totalDemRaw: demTasks.length,
      totalYshubRaw: yshubTickets.length,
      totalYshubAllClosed: filteredYshubAllClosed.length,
      totalSbxBugsRaw: sbxBugsRaw.length,
      totalProdBugsRaw: prodBugsRaw.length,
      totalYshubBugsRaw: yshubBugsRaw.length,
      unmatchedYshub,
      unmatchedDem,
    },
  };
}

export function getRoster() { return loadRoster(); }
export function getRosterForMonth(month: string) { return getActiveRoster(month); }
