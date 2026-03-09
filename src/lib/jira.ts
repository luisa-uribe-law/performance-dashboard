import { DeveloperMonthly, IntegrationTicket, BugTicket, OnCallTicket, Squad, MonthlyTeamMetrics, OnCallPriorityMetrics, PriorityLabel } from "./types";

// ── Config ──
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://yunopayments.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

const AUTH_HEADER = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

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
  const all: JiraIssue[] = [];
  let nextToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({ jql, maxResults: "100", fields });
    if (nextToken) params.set("nextPageToken", nextToken);

    const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
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
  // We require both:
  //   1. status changed to Done/Implementation Complete during the period
  //   2. status is STILL in Done/Implementation Complete (not reverted)
  const epics = await jiraSearchAll(
    `project = DEM AND issuetype = Epic AND status in (Done, "Implementation Complete") AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,statuscategorychangedate"
  );

  const stories = await jiraSearchAll(
    `project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status in (Done, "Implementation Complete") AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,parent,statuscategorychangedate"
  );

  const validStories = stories.filter(s => {
    const summary = getFieldStr(s, "summary").toLowerCase();
    return !summary.includes("dev validation");
  });

  const techDebt = await jiraSearchAll(
    `project = DEM AND issuetype = "Tech Debt" AND status in (Done, "Implementation Complete") AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,issuelinks,duedate,statuscategorychangedate"
  );

  return [...epics, ...validStories, ...techDebt];
}

async function fetchYshubTickets(startDate: string, endDate: string): Promise<JiraIssue[]> {
  return jiraSearchAll(
    `project = YSHUB AND component = Integration AND status changed to (Done, Resolved, Closed) DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,priority,created,resolutiondate,statuscategorychangedate,customfield_10074,customfield_10229,customfield_10196"
  );
}

async function fetchSbxBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  return jiraSearchAll(
    `project = DEM AND issuetype = "In-Sprint Bug" AND status in (Done, "Implementation Complete") AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`,
    "summary,status,assignee,parent"
  );
}

async function fetchProdBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // YSHUB bugs with "Responsible Party of the Bug" (customfield_14104) filled
  return jiraSearchAll(
    `project = YSHUB AND component = Integration AND status changed to (Done, Resolved, Closed) DURING ("${startDate}", "${endDate}") AND cf[14104] is not EMPTY`,
    "summary,assignee,priority,customfield_14104"
  );
}

async function fetchYshubBugs(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // ONLY Bug-type issues from YSHUB, with Provider, Environment, and Responsible Party fields
  return jiraSearchAll(
    `project = YSHUB AND issuetype = Bug AND component = Integration AND created >= "${startDate}" AND created <= "${endDate}"`,
    "summary,priority,status,customfield_10229,customfield_10196,customfield_14104"
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

function getBugEnvironment(issue: JiraIssue): "PROD" | "SBX" | "STG" {
  const envField = getField(issue, "customfield_10196") as Array<{ value?: string }> | null;
  if (!envField || envField.length === 0) return "PROD"; // default if not set
  const values = envField.map(e => (e.value || "").toLowerCase());
  if (values.some(v => v.includes("production") || v.includes("prod"))) return "PROD";
  if (values.some(v => v.includes("staging") || v.includes("stg"))) return "STG";
  if (values.some(v => v.includes("sandbox") || v.includes("sbx") || v.includes("dev"))) return "SBX";
  return "PROD"; // fallback
}

// ── AI Code Ratio (from Span API — hardcoded until token is renewed) ──

const AI_RATIO: Record<string, Record<string, number>> = {
  "2026-01": {
    "Daniela Perea Tarapuez": 35.4,
    "Nicolas Agustin Carolo": 18.8,
    "Diego Alberto Leon Lopez": 35.0,
  },
  "2026-02": {
    "Daniela Perea Tarapuez": 85.6,
    "Nicolas Agustin Carolo": 69.1,
    "Vivek Hasmukhbhai Rajpara": 66.9,
    "Martin Ezequiel Sandroni": 64.4,
    "Diego Alberto Leon Lopez": 56.3,
    "Marcos Isaac Stupnicki": 56.4,
    "Sudheer Kumar Puppala": 56.6,
    "Daniel Betancurth": 51.5,
    "Juan Quintana": 50.7,
    "Juan David Canal Vera": 47.3,
    "Neller Pellegrino Baquero": 47.0,
    "Garvit Gupta": 40.6,
    "Emmanuel Rocha": 39.1,
    "Ever Daniel Rivera Inagan": 38.9,
    "Daniel Andres Hernandez Oyola": 37.8,
    "Andres Salazar Galeano": 15.9,
  },
};

function getAiRatio(month: string, displayName: string): number {
  return AI_RATIO[month]?.[displayName] ?? 0;
}

// ── Main sync function ──

export interface SyncResult {
  month: string;
  teamMetrics: MonthlyTeamMetrics;
  developerMetrics: DeveloperMonthly[];
  onCallPriority: OnCallPriorityMetrics[];
  yshubBugs: BugTicket[];
  debug?: {
    totalDemRaw: number;
    totalYshubRaw: number;
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

  const [demTasks, yshubTickets, sbxBugsRaw, prodBugsRaw, yshubBugsRaw] = await Promise.all([
    fetchDemTasks(startDate, endDate),
    fetchYshubTickets(startDate, endDate),
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

  let unmatchedDem = 0;
  for (const issue of demTasks) {
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
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].sbxBugs.push(issue);
    }
  }

  // PROD bugs count: from YSHUB tickets with Responsible Party (any type, for KPI count)
  let totalProdBugs = 0;
  for (const issue of prodBugsRaw) {
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

    // Weight: DEM tasks use Tasks at Hand, YSHUB use priority
    const weightedTasks = dd.demTasks.reduce((sum, t) => sum + determineWeight(t), 0)
      + dd.yshubTickets.reduce((sum, t) => {
        const priority = (getField(t, "priority") as { name?: string })?.name || "Low";
        const pw: Record<string, number> = { Highest: 3, High: 2, Medium: 1.5, Low: 1 };
        return sum + (pw[priority] || 1);
      }, 0);

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

    const integrations: IntegrationTicket[] = dd.demTasks.map(t => ({
      key: getIssueKey(t),
      summary: getFieldStr(t, "summary"),
      weightedTasks: determineWeight(t),
      onTime: wasOnTime(t) ?? false,
    }));

    const onCallTickets: OnCallTicket[] = dd.yshubTickets.map(t => {
      const sla = extractSla(t);
      return {
        key: getIssueKey(t),
        summary: getFieldStr(t, "summary"),
        priority: (getField(t, "priority") as { name?: string })?.name || "Unknown",
        slaBreached: sla ? sla.breached : false,
        resolutionHrs: sla ? Math.round(sla.elapsedMs / (1000 * 60 * 60) * 10) / 10 : null,
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
      })),
      ...dd.yshubBugsByRP.map(b => ({
        key: getIssueKey(b),
        summary: getFieldStr(b, "summary"),
        env: getBugEnvironment(b),
        provider: getBugProvider(b),
        source: "YSHUB" as const,
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
      aiCodeRatio: getAiRatio(month, entry.displayName),
      ticketsResolved: yshubCount,
      medianResolutionHrs: medianHrs,
      slaCompliancePct: slaPct,
      integrations,
      bugs,
      onCallTickets,
    });
  }

  // ── YSHUB Bug-type issues (project-wide, grouped by provider/env) ──
  const yshubBugs: BugTicket[] = yshubBugsRaw.map(b => ({
    key: getIssueKey(b),
    summary: getFieldStr(b, "summary"),
    env: getBugEnvironment(b),
    provider: getBugProvider(b),
    source: "YSHUB" as const,
  }));

  // ── On-Call priority breakdown ──
  const byPriority: Record<string, JiraIssue[]> = {};
  for (const t of yshubTickets) {
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

  // ── Team metrics ──
  const allHours: number[] = [];
  let teamSlaOk = 0;
  let teamSlaTotal = 0;
  for (const t of yshubTickets) {
    const sla = extractSla(t);
    if (sla) {
      teamSlaTotal++;
      if (!sla.breached) teamSlaOk++;
      allHours.push(sla.elapsedMs / (1000 * 60 * 60));
    }
  }

  const teamMetrics: MonthlyTeamMetrics = {
    month,
    tasksCompleted: totalTasks,
    tasksPerDeveloper: activeDevelopers > 0 ? Math.round((totalTasks / activeDevelopers) * 10) / 10 : 0,
    onTimeDeliveryPct: otdDenominator > 0 ? Math.round(otdNumerator / otdDenominator) : 0,
    prodBugs: totalProdBugs,
    sbxBugs: totalSbxBugs,
    ticketsResolved: yshubTickets.length,
    slaCompliancePct: teamSlaTotal > 0 ? Math.round((teamSlaOk / teamSlaTotal) * 1000) / 10 : 0,
    teamAiRatio: (() => {
      const aiDevs = developerMetrics.filter(d => d.aiCodeRatio > 0);
      return aiDevs.length > 0 ? Math.round(aiDevs.reduce((s, d) => s + d.aiCodeRatio, 0) / aiDevs.length * 10) / 10 : 0;
    })(),
    medianResolutionDays: allHours.length > 0 ? Math.round(median(allHours) / 24 * 10) / 10 : 0,
    activeDevelopers,
  };

  return {
    month,
    teamMetrics,
    developerMetrics,
    onCallPriority,
    yshubBugs,
    debug: {
      totalDemRaw: demTasks.length,
      totalYshubRaw: yshubTickets.length,
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
