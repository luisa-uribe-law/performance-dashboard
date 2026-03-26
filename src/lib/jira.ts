import { DeveloperMonthly, IntegrationTicket, BugTicket, OnCallTicket, Squad, MonthlyTeamMetrics, OnCallPriorityMetrics, BugSlaMetrics, BugSlaPriorityMetrics, PriorityLabel, TimeBlockedTicket, TimeBlockedMonthly, StatusTransition } from "./types";

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

// ── Load DEM keys already counted in past months (to prevent double-counting) ──

function loadPastDemKeys(currentMonth: string): Set<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dataDir = path.join(process.cwd(), "data");
  const keys = new Set<string>();

  if (!fs.existsSync(dataDir)) return keys;

  const files = fs.readdirSync(dataDir) as string[];
  for (const file of files) {
    const match = file.match(/^sync-(\d{4}-\d{2})\.json$/);
    if (!match || match[1] >= currentMonth) continue; // only past months

    try {
      const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
      const data = JSON.parse(raw);
      for (const dev of data.developerMetrics || []) {
        for (const integ of dev.integrations || []) {
          if (integ.key) keys.add(integ.key);
        }
      }
    } catch { /* skip corrupt files */ }
  }
  return keys;
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

// Cutoff date: before this, IC + Done both count. From this date onwards, only Done.
const DONE_ONLY_CUTOFF = "2026-03-18";

async function fetchDemTasks(startDate: string, endDate: string): Promise<JiraIssue[]> {
  // Before 2026-03-18: "Implementation Complete" or "Done" both count as complete.
  // From 2026-03-18 onwards: only "Done" counts.
  // If a period spans the cutoff (e.g. March), we split into two sub-queries.

  const epicFields = "summary,status,assignee,issuelinks,duedate,statuscategorychangedate";
  const storyFields = epicFields + ",parent";

  let epics: JiraIssue[] = [];
  let stories: JiraIssue[] = [];
  let techDebt: JiraIssue[] = [];

  if (endDate < DONE_ONLY_CUTOFF) {
    // Entire period before cutoff: IC + Done
    epics = await jiraSearchAll(`project = DEM AND issuetype = Epic AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`, epicFields);
    stories = await jiraSearchAll(`project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`, storyFields);
    techDebt = await jiraSearchAll(`project = DEM AND issuetype = "Tech Debt" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`, epicFields);
  } else if (startDate >= DONE_ONLY_CUTOFF) {
    // Entire period after cutoff: Done only
    epics = await jiraSearchAll(`project = DEM AND issuetype = Epic AND status changed to Done DURING ("${startDate}", "${endDate}")`, epicFields);
    stories = await jiraSearchAll(`project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status changed to Done DURING ("${startDate}", "${endDate}")`, storyFields);
    techDebt = await jiraSearchAll(`project = DEM AND issuetype = "Tech Debt" AND status changed to Done DURING ("${startDate}", "${endDate}")`, epicFields);
  } else {
    // Period spans cutoff: split into before (IC+Done) and after (Done only)
    const beforeEnd = "2026-03-17";
    const [e1, s1, t1, e2, s2, t2] = await Promise.all([
      jiraSearchAll(`project = DEM AND issuetype = Epic AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${beforeEnd}")`, epicFields),
      jiraSearchAll(`project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${beforeEnd}")`, storyFields),
      jiraSearchAll(`project = DEM AND issuetype = "Tech Debt" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${beforeEnd}")`, epicFields),
      jiraSearchAll(`project = DEM AND issuetype = Epic AND status changed to Done DURING ("${DONE_ONLY_CUTOFF}", "${endDate}")`, epicFields),
      jiraSearchAll(`project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND status changed to Done DURING ("${DONE_ONLY_CUTOFF}", "${endDate}")`, storyFields),
      jiraSearchAll(`project = DEM AND issuetype = "Tech Debt" AND status changed to Done DURING ("${DONE_ONLY_CUTOFF}", "${endDate}")`, epicFields),
    ]);
    // Deduplicate by key (a ticket could match both sub-periods)
    const seen = new Set<string>();
    for (const i of [...e1, ...e2]) { if (!seen.has(getIssueKey(i))) { seen.add(getIssueKey(i)); epics.push(i); } }
    for (const i of [...s1, ...s2]) { if (!seen.has(getIssueKey(i))) { seen.add(getIssueKey(i)); stories.push(i); } }
    for (const i of [...t1, ...t2]) { if (!seen.has(getIssueKey(i))) { seen.add(getIssueKey(i)); techDebt.push(i); } }
  }

  const validStories = stories.filter(s => {
    const summary = getFieldStr(s, "summary").toLowerCase();
    return !summary.includes("dev validation");
  });

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
  const fields = "summary,status,assignee,parent";
  if (endDate < DONE_ONLY_CUTOFF) {
    return jiraSearchAll(`project = DEM AND issuetype = "In-Sprint Bug" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "${endDate}")`, fields);
  } else if (startDate >= DONE_ONLY_CUTOFF) {
    return jiraSearchAll(`project = DEM AND issuetype = "In-Sprint Bug" AND status changed to Done DURING ("${startDate}", "${endDate}")`, fields);
  } else {
    const [before, after] = await Promise.all([
      jiraSearchAll(`project = DEM AND issuetype = "In-Sprint Bug" AND status changed to (Done, "Implementation Complete") DURING ("${startDate}", "2026-03-17")`, fields),
      jiraSearchAll(`project = DEM AND issuetype = "In-Sprint Bug" AND status changed to Done DURING ("${DONE_ONLY_CUTOFF}", "${endDate}")`, fields),
    ]);
    const seen = new Set<string>();
    const result: JiraIssue[] = [];
    for (const i of [...before, ...after]) { if (!seen.has(getIssueKey(i))) { seen.add(getIssueKey(i)); result.push(i); } }
    return result;
  }
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
  unmatchedOnCallTickets: OnCallTicket[];
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
    skippedDuplicateDem: number;
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

  // Load DEM keys already counted in past months to prevent double-counting.
  // A ticket that reached IC in Feb (frozen in cached data) and later moves to Done
  // will appear in the "status changed to Done" query but must be skipped.
  const pastDemKeys = loadPastDemKeys(month);

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
  // For DEM tasks this also prevents double-counting: if a ticket reached "Implementation Complete"
  // in Feb and gets bulk-moved to "Done" in March, statuscategorychangedate stays at Feb
  // (same Done category), so it's only attributed to Feb.
  function completedInMonth(issue: JiraIssue): boolean {
    const raw = getFieldStr(issue, "statuscategorychangedate") || getFieldStr(issue, "resolutiondate");
    if (!raw) return true; // no date available, keep it
    const completedMonth = raw.slice(0, 7); // "2026-02" — use local date as-is, no UTC conversion
    return completedMonth === month;
  }

  let unmatchedDem = 0;
  let skippedDuplicateDem = 0;
  for (const issue of demTasks) {
    if (!completedInMonth(issue)) continue;
    const key = getIssueKey(issue);
    if (pastDemKeys.has(key)) { skippedDuplicateDem++; continue; }
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].demTasks.push(issue);
    } else {
      unmatchedDem++;
    }
  }

  let unmatchedYshub = 0;
  const unmatchedYshubTickets: JiraIssue[] = [];
  for (const issue of yshubTickets) {
    if (!completedInMonth(issue)) continue;
    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry && devData[entry.displayName]) {
      devData[entry.displayName].yshubTickets.push(issue);
    } else {
      unmatchedYshub++;
      unmatchedYshubTickets.push(issue);
    }
  }

  // SBX bugs: only count those assigned to roster members, skip if already counted
  for (const issue of sbxBugsRaw) {
    if (!completedInMonth(issue)) continue;
    if (pastDemKeys.has(getIssueKey(issue))) continue;
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
        closedDate: cd ? cd.slice(0, 10) : null,
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
        closedDate: cd ? cd.slice(0, 10) : null,
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

  // ── On-Call priority breakdown (excludes Canceled — consistent with developer counts) ──
  // Filter to only tickets whose completion date matches the requested month
  const filteredYshubAllClosed = yshubAllClosed.filter(completedInMonth);
  const filteredYshubForPriority = yshubTickets.filter(completedInMonth);
  const byPriority: Record<string, JiraIssue[]> = {};
  for (const t of filteredYshubForPriority) {
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

  // ── Team metrics (excludes Canceled — consistent with developer-level counts) ──
  const filteredYshubTickets = yshubTickets.filter(completedInMonth);
  const allHours: number[] = [];
  let teamSlaOk = 0;
  let teamSlaTotal = 0;
  for (const t of filteredYshubTickets) {
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
    ticketsResolved: filteredYshubTickets.length, // Excludes Canceled — matches developer ticket list
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

  // Build OnCallTicket objects for unmatched YSHUB tickets
  const unmatchedOnCallTickets: OnCallTicket[] = unmatchedYshubTickets.map(t => {
    const sla = extractSla(t);
    const cd = getFieldStr(t, "statuscategorychangedate") || getFieldStr(t, "resolutiondate");
    return {
      key: getIssueKey(t),
      summary: getFieldStr(t, "summary"),
      priority: (getField(t, "priority") as { name?: string })?.name || "Unknown",
      slaBreached: sla ? sla.breached : false,
      resolutionHrs: sla ? Math.round(sla.elapsedMs / (1000 * 60 * 60) * 10) / 10 : null,
      closedDate: cd ? cd.slice(0, 10) : null,
    };
  });

  return {
    month,
    teamMetrics,
    developerMetrics,
    unmatchedOnCallTickets,
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
      skippedDuplicateDem,
    },
  };
}

// ── Time Blocked Analysis ──

// Categorize Jira statuses into workflow phases
const ACTIVE_STATUSES = new Set([
  "in progress", "in development", "code review", "in review", "testing",
  "in testing", "qa", "dev in progress", "development", "implementing",
]);
const BLOCKED_STATUSES = new Set([
  "blocked", "on hold", "waiting", "pending", "waiting for support",
  "waiting for customer", "impediment", "paused",
]);
const DONE_STATUSES = new Set([
  "done", "implementation complete", "closed", "resolved", "released",
  "deployment in queue", "deployed",
]);

function categorizeStatus(status: string): StatusTransition["category"] {
  const lower = status.toLowerCase();
  if (DONE_STATUSES.has(lower)) return "done";
  if (ACTIVE_STATUSES.has(lower)) return "active";
  if (BLOCKED_STATUSES.has(lower)) return "blocked";
  return "queue"; // To Do, Backlog, Open, etc.
}

interface JiraChangelog {
  histories: Array<{
    created: string;
    items: Array<{
      field: string;
      fromString: string | null;
      toString: string | null;
    }>;
  }>;
}

// Fetch changelogs for a batch of issue keys
async function fetchChangelogs(keys: string[]): Promise<Map<string, JiraChangelog>> {
  const { baseUrl, auth } = getJiraConfig();
  const result = new Map<string, JiraChangelog>();
  if (keys.length === 0) return result;

  // Batch in groups of 50 to avoid JQL length limits
  const batchSize = 50;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const jql = `key in (${batch.join(",")})`;
    const params = new URLSearchParams({
      jql,
      maxResults: "100",
      fields: "created,status",
      expand: "changelog",
    });

    const url = `${baseUrl}/rest/api/3/search/jql?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      console.error(`Changelog fetch failed: ${resp.status}`);
      continue;
    }

    const data = await resp.json() as {
      issues: Array<{
        key?: string;
        id: string;
        fields: Record<string, unknown>;
        changelog?: JiraChangelog;
      }>;
    };

    for (const issue of data.issues) {
      const key = issue.key || issue.id;
      if (issue.changelog) {
        result.set(key, issue.changelog);
      }
    }
  }

  return result;
}

// Build status transition timeline from changelog.
// KEY RULE: Only count time AFTER the ticket first enters an active status
// (In Progress, In Development, etc.). Time in To Do/Backlog before first
// active status is excluded. "Blocked" only means statuses like Blocked,
// On Hold — NOT queue/To Do time.
function buildTransitions(
  createdDate: Date,
  changelog: JiraChangelog,
  completedDate: Date,
): { transitions: StatusTransition[]; firstActiveDate: Date | null } {
  // Extract all status changes sorted chronologically
  const statusChanges: Array<{ timestamp: Date; from: string; to: string }> = [];

  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field === "status" && item.toString) {
        statusChanges.push({
          timestamp: parseJiraDate(history.created),
          from: item.fromString || "Unknown",
          to: item.toString,
        });
      }
    }
  }

  statusChanges.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (statusChanges.length === 0) {
    return { transitions: [], firstActiveDate: null };
  }

  // Find the first transition INTO an active status — this is when work actually started
  let firstActiveIdx = -1;
  for (let i = 0; i < statusChanges.length; i++) {
    if (categorizeStatus(statusChanges[i].to) === "active") {
      firstActiveIdx = i;
      break;
    }
  }

  // If no active status was ever entered, no meaningful cycle time
  if (firstActiveIdx === -1) {
    return { transitions: [], firstActiveDate: null };
  }

  // Check if the ticket was "completed" then reopened (e.g., accidental Implementation Complete).
  // If so, restart the cycle from the LAST re-entry into active after a done status.
  let cycleStartIdx = firstActiveIdx;
  for (let i = firstActiveIdx + 1; i < statusChanges.length; i++) {
    const prevCat = categorizeStatus(statusChanges[i - 1].to);
    const currCat = categorizeStatus(statusChanges[i].to);
    if (prevCat === "done" && (currCat === "active" || currCat === "queue")) {
      // Find the next active status from here
      for (let j = i; j < statusChanges.length; j++) {
        if (categorizeStatus(statusChanges[j].to) === "active") {
          cycleStartIdx = j;
          break;
        }
      }
    }
  }

  const actualStartDate = statusChanges[cycleStartIdx].timestamp;
  const transitions: StatusTransition[] = [];

  // Only build transitions from the cycle start onwards
  for (let i = cycleStartIdx; i < statusChanges.length; i++) {
    const current = statusChanges[i];
    const next = statusChanges[i + 1];
    const exitTime = next ? next.timestamp : completedDate;
    const days = workingDaysFraction(current.timestamp, exitTime);

    transitions.push({
      status: current.to,
      enteredAt: current.timestamp.toISOString(),
      exitedAt: exitTime.toISOString(),
      durationDays: Math.round(days * 10) / 10,
      category: categorizeStatus(current.to),
    });
  }

  return { transitions, firstActiveDate: actualStartDate };
}

// Count working days (Mon-Fri) between two dates
function workingDays(start: Date, end: Date): number {
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  // Fast path: iterate day by day
  while (cur < end) {
    const dow = cur.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  // Add fractional last day if end is mid-day
  const lastDow = end.getDay();
  if (lastDow !== 0 && lastDow !== 6) {
    const dayStart = new Date(end);
    dayStart.setHours(0, 0, 0, 0);
    const frac = (end.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24);
    // We already counted full days, so adjust: remove the last full day count if we went past
    // Actually, the loop above stops when cur >= end, so partial days aren't counted.
    // For simplicity, just use the fractional amount if the iteration missed it.
  }
  // Convert to fractional: total ms / ms-per-day gives calendar days,
  // but we want working days. Use the integer count and add fraction of last working day.
  return Math.max(0, Math.round(count * 10) / 10);
}

// Working days as a float (more precise for transition durations)
function workingDaysFraction(start: Date, end: Date): number {
  if (end <= start) return 0;
  const totalCalendarDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (totalCalendarDays <= 0) return 0;

  // Count complete weeks and remaining days
  const fullWeeks = Math.floor(totalCalendarDays / 7);
  let workDays = fullWeeks * 5;

  // Count remaining partial week
  const remaining = totalCalendarDays - fullWeeks * 7;
  const startDay = start.getDay(); // 0=Sun, 6=Sat
  for (let i = 0; i < Math.ceil(remaining); i++) {
    const dow = (startDay + (fullWeeks * 7) + i) % 7;
    if (dow !== 0 && dow !== 6) workDays++;
  }

  // Scale by fraction of the last partial day
  const wholeDays = Math.ceil(totalCalendarDays);
  if (wholeDays > 0) {
    workDays = workDays * (totalCalendarDays / wholeDays);
  }

  return Math.max(0, Math.round(workDays * 10) / 10);
}

// Main function: compute time-blocked analysis for a month
export async function computeTimeBlocked(month: string): Promise<TimeBlockedMonthly> {
  const [year, m] = month.split("-");
  const startDate = `${year}-${m}-01`;
  const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
  const endDate = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;

  // Use the same fetch logic as the main sync to ensure task counts match
  const demTasks = await fetchDemTasks(startDate, endDate);
  const pastDemKeys = loadPastDemKeys(month);
  const roster = getActiveRoster(month);

  // Filter same as syncMonth: completedInMonth + dedup + roster match
  const filtered: Array<{ issue: JiraIssue; developer: string }> = [];

  for (const issue of demTasks) {
    const raw = getFieldStr(issue, "statuscategorychangedate") || getFieldStr(issue, "resolutiondate");
    if (raw) {
      const completedMonth = raw.slice(0, 7); // use local date as-is, no UTC conversion
      if (completedMonth !== month) continue;
    }
    const key = getIssueKey(issue);
    if (pastDemKeys.has(key)) continue;

    const jiraName = getAssigneeName(issue);
    const entry = resolveJiraName(jiraName);
    if (entry) {
      filtered.push({ issue, developer: entry.displayName });
    }
  }

  // Fetch changelogs for all filtered tasks
  const keys = filtered.map(f => getIssueKey(f.issue));
  const changelogs = await fetchChangelogs(keys);

  // Also fetch created dates (re-query with created field)
  const createdDates = new Map<string, Date>();
  if (keys.length > 0) {
    const batchSize = 50;
    const { baseUrl, auth } = getJiraConfig();
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const jql = `key in (${batch.join(",")})`;
      const resp = await fetch(`${baseUrl}/rest/api/3/search/jql?${new URLSearchParams({ jql, maxResults: "100", fields: "created" })}`, {
        headers: { Authorization: auth, "Content-Type": "application/json" },
      });
      if (resp.ok) {
        const data = await resp.json() as { issues: JiraIssue[] };
        for (const issue of data.issues) {
          const key = issue.key || issue.id;
          const created = getFieldStr(issue, "created");
          if (created) createdDates.set(key, parseJiraDate(created));
        }
      }
    }
  }

  // Build time-blocked tickets
  // IMPORTANT: "cycle time" = first In Progress → Done (excludes To Do/Backlog wait)
  // "blocked" = only actual Blocked/On Hold statuses, NOT queue/To Do time
  const tickets: TimeBlockedTicket[] = [];

  for (const { issue, developer } of filtered) {
    const key = getIssueKey(issue);
    const completedStr = getFieldStr(issue, "statuscategorychangedate") || getFieldStr(issue, "resolutiondate");
    if (!completedStr) continue;

    const completedDate = parseJiraDate(completedStr);
    const createdDate = createdDates.get(key);
    if (!createdDate) continue;

    const changelog = changelogs.get(key);
    if (!changelog) continue; // Skip tickets with no changelog — can't compute cycle time

    const { transitions, firstActiveDate } = buildTransitions(createdDate, changelog, completedDate);
    if (!firstActiveDate || transitions.length === 0) continue; // Never entered active status

    // Cycle time = first In Progress → Done (not created → done)
    const cycleTimeDays = workingDaysFraction(firstActiveDate, completedDate);
    if (cycleTimeDays <= 0) continue;

    let activeTimeDays = 0;
    let blockedTimeDays = 0;

    for (const t of transitions) {
      if (t.category === "active") activeTimeDays += t.durationDays;
      else if (t.category === "blocked") blockedTimeDays += t.durationDays;
      // "queue" transitions after first active = blocked (ticket was started then stalled)
      else if (t.category === "queue") blockedTimeDays += t.durationDays;
      // "done" at end of cycle is final completion — not counted as active or blocked
    }

    // Clamp values
    activeTimeDays = Math.max(0, Math.min(activeTimeDays, cycleTimeDays));
    blockedTimeDays = Math.max(0, Math.min(blockedTimeDays, cycleTimeDays));
    if (activeTimeDays + blockedTimeDays > cycleTimeDays) {
      const total = activeTimeDays + blockedTimeDays;
      activeTimeDays = Math.round((activeTimeDays / total) * cycleTimeDays * 10) / 10;
      blockedTimeDays = Math.round((blockedTimeDays / total) * cycleTimeDays * 10) / 10;
    }

    const blockedPct = cycleTimeDays > 0 ? Math.round((blockedTimeDays / cycleTimeDays) * 1000) / 10 : 0;

    tickets.push({
      key,
      summary: getFieldStr(issue, "summary"),
      developer,
      weight: determineWeight(issue),
      createdDate: firstActiveDate.toISOString().slice(0, 10), // start = first In Progress
      completedDate: completedDate.toISOString().slice(0, 10),
      leadTimeDays: cycleTimeDays, // this is now cycle time (first active → done)
      activeTimeDays: Math.round(activeTimeDays * 10) / 10,
      blockedTimeDays: Math.round(blockedTimeDays * 10) / 10,
      blockedPct,
      transitions,
    });
  }

  // Compute averages and medians
  const n = tickets.length;
  const avgLeadTimeDays = n > 0 ? Math.round(tickets.reduce((s, t) => s + t.leadTimeDays, 0) / n * 10) / 10 : 0;
  const avgActiveTimeDays = n > 0 ? Math.round(tickets.reduce((s, t) => s + t.activeTimeDays, 0) / n * 10) / 10 : 0;
  const avgBlockedTimeDays = n > 0 ? Math.round(tickets.reduce((s, t) => s + t.blockedTimeDays, 0) / n * 10) / 10 : 0;
  const avgBlockedPct = n > 0 ? Math.round(tickets.reduce((s, t) => s + t.blockedPct, 0) / n * 10) / 10 : 0;

  const medLeadTimeDays = n > 0 ? Math.round(median(tickets.map(t => t.leadTimeDays)) * 10) / 10 : 0;
  const medActiveTimeDays = n > 0 ? Math.round(median(tickets.map(t => t.activeTimeDays)) * 10) / 10 : 0;
  const medBlockedTimeDays = n > 0 ? Math.round(median(tickets.map(t => t.blockedTimeDays)) * 10) / 10 : 0;
  const medBlockedPct = n > 0 ? Math.round(median(tickets.map(t => t.blockedPct)) * 10) / 10 : 0;

  // Outlier detection: blocked time OR cycle time > Q3 + 1.5 * IQR
  let outlierCount = 0;
  if (n >= 4) {
    const sortedBlocked = tickets.map(t => t.blockedTimeDays).sort((a, b) => a - b);
    const bq1 = sortedBlocked[Math.floor(n * 0.25)];
    const bq3 = sortedBlocked[Math.floor(n * 0.75)];
    const blockedFence = bq3 + 1.5 * (bq3 - bq1);
    const sortedCycle = tickets.map(t => t.leadTimeDays).sort((a, b) => a - b);
    const cq1 = sortedCycle[Math.floor(n * 0.25)];
    const cq3 = sortedCycle[Math.floor(n * 0.75)];
    const cycleFence = cq3 + 1.5 * (cq3 - cq1);
    outlierCount = tickets.filter(t => t.blockedTimeDays > blockedFence || t.leadTimeDays > cycleFence).length;
  }

  return {
    month,
    totalTasks: n,
    avgLeadTimeDays,
    avgActiveTimeDays,
    avgBlockedTimeDays,
    avgBlockedPct,
    medLeadTimeDays,
    medActiveTimeDays,
    medBlockedTimeDays,
    medBlockedPct,
    outlierCount,
    tickets,
  };
}

export function getRoster() { return loadRoster(); }
export function getRosterForMonth(month: string) { return getActiveRoster(month); }
