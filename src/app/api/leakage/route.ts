import { NextRequest, NextResponse } from "next/server";
import { LeakageIntegration, LeakageBug, LeakageData } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

function getJiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL || "https://yunopayments.atlassian.net";
  const email = process.env.JIRA_EMAIL || "";
  const token = process.env.JIRA_API_TOKEN || "";
  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  return { baseUrl, auth };
}

// ── Roster (same logic as jira.ts to ensure consistent filtering) ──
interface RosterEntry {
  displayName: string;
  jiraNames: string[];
  active: boolean;
  activeFrom?: string;
  activeTo?: string;
}

function loadRoster(): RosterEntry[] {
  const rosterPath = path.join(process.cwd(), "data/roster.json");
  const raw = fs.readFileSync(rosterPath, "utf-8");
  return JSON.parse(raw);
}

function resolveJiraName(jiraDisplayName: string): RosterEntry | undefined {
  const lower = jiraDisplayName.toLowerCase();
  return loadRoster().find(r => r.jiraNames.some(n => n.toLowerCase() === lower));
}

function isRosterMember(assigneeName: string): boolean {
  return !!resolveJiraName(assigneeName);
}

// Load DEM task keys from past months' cached data to prevent double-counting.
// A ticket that was counted via "Implementation Complete" in a past month should
// not be counted again when it later reaches "Done".
function loadPastDemKeys(fromMonth: string): Set<string> {
  const dataDir = path.join(process.cwd(), "data");
  const keys = new Set<string>();
  if (!fs.existsSync(dataDir)) return keys;

  const files = fs.readdirSync(dataDir) as string[];
  for (const file of files) {
    const match = file.match(/^sync-(\d{4}-\d{2})\.json$/);
    if (!match || match[1] >= fromMonth) continue; // only months before the requested range
    try {
      const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
      const data = JSON.parse(raw);
      for (const dev of data.developerMetrics || []) {
        for (const integ of dev.integrations || []) {
          if (integ.key) keys.add(integ.key);
        }
      }
    } catch { /* skip */ }
  }
  return keys;
}

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

    const resp = await fetch(`${baseUrl}/rest/api/3/search/jql?${params}`, {
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

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || "2026-01";
  const to = searchParams.get("to") || "2026-12";

  const startDate = `${from}-01`;
  const toYear = parseInt(to.split("-")[0]);
  const toMonth = parseInt(to.split("-")[1]);
  const endDate = `${toYear}-${String(toMonth).padStart(2, "0")}-${new Date(toYear, toMonth, 0).getDate()}`;

  try {
    // 1. Fetch completed DEM tasks in the period
    //    Epics = full integrations
    //    Standalone Stories (no Epic Link) = independent work items
    //    Tech Debt = maintenance/improvement tasks
    //    Excludes sub-stories that belong to an Epic (those are implementation tasks, not integrations)
    //    Only "Done" counts as complete (from 2026-03-18 onwards).
    //    Past months are frozen in cached JSON; dedup prevents double-counting.
    const duringClause = `status changed to Done DURING ("${startDate}", "${endDate}")`;
    const sharedFields = "summary,assignee,statuscategorychangedate";

    const [epics, standaloneStories, techDebt] = await Promise.all([
      jiraSearchAll(
        `project = DEM AND issuetype = Epic AND ${duringClause}`,
        sharedFields
      ),
      jiraSearchAll(
        `project = DEM AND issuetype = Story AND "Epic Link" is EMPTY AND ${duringClause}`,
        sharedFields + ",parent"
      ),
      jiraSearchAll(
        `project = DEM AND issuetype = "Tech Debt" AND ${duringClause}`,
        sharedFields
      ),
    ]);

    // Filter out Dev Validation stories
    const validStories = standaloneStories.filter(s => {
      const summary = typeof s.fields.summary === "string" ? s.fields.summary.toLowerCase() : "";
      return !summary.includes("dev validation");
    });
    const demTasks = [...epics, ...validStories, ...techDebt];

    // Build a map of DEM keys -> deployment info
    // Filter by statuscategorychangedate to match requested period and prevent double-counting.
    // Also filter by roster membership to stay consistent with the main dashboard.
    let skippedNonRoster = 0;
    const demMap = new Map<string, { key: string; summary: string; assignee: string; deployedDate: string }>();
    for (const t of demTasks) {
      const key = t.key || t.id;
      const summary = typeof t.fields.summary === "string" ? t.fields.summary : "";
      const assignee = (t.fields.assignee as { displayName?: string } | null)?.displayName || "Unassigned";
      const rawDate = t.fields.statuscategorychangedate;
      if (!rawDate || typeof rawDate !== "string") continue;
      const deployedDate = rawDate.slice(0, 10);
      // Only include if deployedDate falls within the requested from–to range
      const deployedMonth = deployedDate.slice(0, 7);
      if (deployedMonth < from || deployedMonth > to) continue;
      // Only include tasks assigned to team members (any past or present roster member)
      if (!isRosterMember(assignee)) {
        skippedNonRoster++;
        continue;
      }
      demMap.set(key, { key, summary, assignee, deployedDate });
    }

    // 1b. Remove DEM keys already counted in past months (prevents double-counting
    //     tickets that reached IC historically and later moved to Done)
    const pastKeys = loadPastDemKeys(from);
    for (const key of pastKeys) {
      demMap.delete(key);
    }

    // 2. Fetch YSHUB bugs with triage completed (Responsible Party, Responsible, Parent, Context all filled)
    //    No date filter on bugs — we want ALL bugs linked to integrations in our period,
    //    even if the bug was reported months after deployment
    const yshubBugs = await jiraSearchAll(
      `project = YSHUB AND issuetype = Bug AND component = Integration AND parent is not EMPTY AND "Responsible Party of the Bug" is not EMPTY AND Responsible is not EMPTY AND cf[14137] is not EMPTY`,
      "summary,parent,created"
    );

    // 3. Group bugs by parent DEM key
    const bugsByDem = new Map<string, LeakageBug[]>();
    for (const bug of yshubBugs) {
      const parent = bug.fields.parent as { key?: string } | null;
      if (!parent?.key) continue;
      const parentKey = parent.key;
      if (!parentKey.startsWith("DEM-")) continue;

      const dem = demMap.get(parentKey);
      if (!dem) continue; // Parent DEM not in our filtered period

      const bugKey = bug.key || bug.id;
      const bugSummary = typeof bug.fields.summary === "string" ? bug.fields.summary : "";
      const createdRaw = bug.fields.created as string;
      const createdDate = createdRaw?.slice(0, 10) || "";

      const deployDate = new Date(dem.deployedDate);
      const bugDate = new Date(createdDate);
      const daysDiff = Math.round((bugDate.getTime() - deployDate.getTime()) / (1000 * 60 * 60 * 24));

      if (!bugsByDem.has(parentKey)) bugsByDem.set(parentKey, []);
      bugsByDem.get(parentKey)!.push({
        key: bugKey,
        summary: bugSummary,
        createdDate,
        daysSinceDeployment: Math.max(0, daysDiff),
      });
    }

    // 4. Build integrations list with their bugs
    const integrations: LeakageIntegration[] = [];
    const allLeakageDays: number[] = [];

    for (const [demKey, dem] of demMap) {
      const bugs = bugsByDem.get(demKey) || [];
      // Sort bugs by creation date
      bugs.sort((a, b) => a.createdDate.localeCompare(b.createdDate));

      integrations.push({
        key: demKey,
        summary: dem.summary,
        assignee: dem.assignee,
        deployedDate: dem.deployedDate,
        bugs,
      });

      for (const b of bugs) {
        allLeakageDays.push(b.daysSinceDeployment);
      }
    }

    // Sort: integrations with bugs first (by bug count desc), then bug-free
    integrations.sort((a, b) => {
      if (a.bugs.length > 0 && b.bugs.length === 0) return -1;
      if (a.bugs.length === 0 && b.bugs.length > 0) return 1;
      if (a.bugs.length !== b.bugs.length) return b.bugs.length - a.bugs.length;
      return a.deployedDate.localeCompare(b.deployedDate);
    });

    const integrationsWithBugs = integrations.filter(i => i.bugs.length > 0).length;
    const totalIntegrations = integrations.length;

    const result: LeakageData = {
      integrations,
      totalIntegrations,
      integrationsWithBugs,
      totalBugs: allLeakageDays.length,
      medianLeakageDays: median(allLeakageDays),
      avgLeakageDays: allLeakageDays.length > 0
        ? Math.round((allLeakageDays.reduce((s, d) => s + d, 0) / allLeakageDays.length) * 10) / 10
        : null,
      bugFreeRate: totalIntegrations > 0
        ? Math.round(((totalIntegrations - integrationsWithBugs) / totalIntegrations) * 100)
        : 100,
      skippedNonRoster,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Leakage API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
