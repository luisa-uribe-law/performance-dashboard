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

// Build DEM integration map from the same cached sync files the main dashboard uses.
// This ensures both screens count exactly the same integrations.
function loadDemMapFromCache(from: string, to: string): Map<string, { key: string; summary: string; assignee: string; deployedDate: string }> {
  const dataDir = path.join(process.cwd(), "data");
  const demMap = new Map<string, { key: string; summary: string; assignee: string; deployedDate: string }>();

  if (!fs.existsSync(dataDir)) return demMap;

  const files = fs.readdirSync(dataDir) as string[];
  for (const file of files) {
    const match = file.match(/^sync-(\d{4}-\d{2})\.json$/);
    if (!match) continue;
    const month = match[1];
    if (month < from || month > to) continue;

    try {
      const raw = fs.readFileSync(path.join(dataDir, file), "utf-8");
      const data = JSON.parse(raw);
      for (const dev of data.developerMetrics || []) {
        for (const integ of dev.integrations || []) {
          if (!integ.key || demMap.has(integ.key)) continue;
          demMap.set(integ.key, {
            key: integ.key,
            summary: integ.summary || "",
            assignee: dev.developer || "Unassigned",
            deployedDate: integ.closedDate || "",
          });
        }
      }
    } catch { /* skip */ }
  }

  return demMap;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || "2026-01";
  const to = searchParams.get("to") || "2026-12";

  try {
    // 1. Load DEM integrations from cached sync files (same source as main dashboard)
    const demMap = loadDemMapFromCache(from, to);

    // 2. Fetch YSHUB bugs with triage completed (Responsible Party, Responsible, Context all filled)
    //    Integration is now linked as a "linked work item" instead of the old Parent field.
    //    No date filter on bugs — we want ALL bugs linked to integrations in our period,
    //    even if the bug was reported months after deployment
    const yshubBugs = await jiraSearchAll(
      `project = YSHUB AND issuetype = Bug AND component = Integration AND "Responsible Party of the Bug" is not EMPTY AND Responsible is not EMPTY AND cf[14137] is not EMPTY`,
      "summary,issuelinks,created"
    );

    // 3. Group bugs by linked DEM key (via issuelinks)
    const bugsByDem = new Map<string, LeakageBug[]>();
    for (const bug of yshubBugs) {
      const issuelinks = bug.fields.issuelinks as Array<{
        inwardIssue?: { key?: string };
        outwardIssue?: { key?: string };
      }> | null;
      if (!issuelinks || issuelinks.length === 0) continue;

      // Find all linked DEM keys
      for (const link of issuelinks) {
        const linkedKey = link.inwardIssue?.key || link.outwardIssue?.key;
        if (!linkedKey || !linkedKey.startsWith("DEM-")) continue;

        const dem = demMap.get(linkedKey);
        if (!dem) continue; // Linked DEM not in our filtered period

        const bugKey = bug.key || bug.id;
        const bugSummary = typeof bug.fields.summary === "string" ? bug.fields.summary : "";
        const createdRaw = bug.fields.created as string;
        const createdDate = createdRaw?.slice(0, 10) || "";

        const deployDate = new Date(dem.deployedDate);
        const bugDate = new Date(createdDate);
        const daysDiff = Math.round((bugDate.getTime() - deployDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!bugsByDem.has(linkedKey)) bugsByDem.set(linkedKey, []);
        bugsByDem.get(linkedKey)!.push({
          key: bugKey,
          summary: bugSummary,
          createdDate,
          daysSinceDeployment: Math.max(0, daysDiff),
        });
      }
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
      skippedNonRoster: 0,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Leakage API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
