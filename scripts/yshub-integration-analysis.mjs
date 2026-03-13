#!/usr/bin/env node
// One-off script to pull YSHUB Integration issues for analysis

const JIRA_BASE_URL = "https://yunopayments.atlassian.net";
const JIRA_EMAIL = "luisa.uribe@y.uno";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_API_TOKEN) {
  console.error("Set JIRA_API_TOKEN env var");
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

const FIELDS = "summary,priority,status,created,resolutiondate,statuscategorychangedate,labels,customfield_10229,customfield_10196,customfield_14104,components,issuetype";

async function jiraSearchAll(jql, maxTotal = 999) {
  const all = [];
  let nextToken;
  while (true) {
    const params = new URLSearchParams({ jql, maxResults: "100", fields: FIELDS });
    if (nextToken) params.set("nextPageToken", nextToken);
    const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: AUTH, "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`Jira API ${resp.status}: ${body.slice(0, 500)}`);
      if (resp.status === 400 && body.includes("component")) return null;
      throw new Error(`Jira API ${resp.status}`);
    }
    const data = await resp.json();
    all.push(...data.issues);
    if (all.length >= maxTotal) break;
    if (data.isLast !== false) break;
    nextToken = data.nextPageToken;
    if (!nextToken) break;
  }
  return all;
}

function extract(issue) {
  const f = issue.fields;
  const priority = f.priority?.name || "Unknown";
  const status = f.status?.name || "Unknown";
  const provider = f.customfield_10229?.value || null;
  const envField = f.customfield_10196;
  const environment = Array.isArray(envField) ? envField.map(e => e.value).join(", ") : (envField?.value || null);
  const responsibleParty = f.customfield_14104?.displayName || f.customfield_14104?.value || null;
  const labels = f.labels || [];
  const components = (f.components || []).map(c => c.name);
  const issueType = f.issuetype?.name || "Unknown";

  return {
    key: issue.key,
    summary: f.summary,
    issueType,
    priority,
    status,
    created: f.created,
    resolutionDate: f.resolutiondate || null,
    statusCategoryChangeDate: f.statuscategorychangedate || null,
    provider,
    environment,
    responsibleParty,
    labels,
    components,
  };
}

async function runQuery(name, jql, maxTotal = 999) {
  console.error(`\n=== Query: ${name} ===`);
  console.error(`JQL: ${jql}`);
  let results = await jiraSearchAll(jql, maxTotal);

  // If failed due to component issue, retry without component filter
  if (results === null) {
    const fallbackJql = jql.replace(/AND component = Integration\s*/g, "").replace(/AND component = Integrations\s*/g, "");
    console.error(`Component filter failed, retrying: ${fallbackJql}`);
    results = await jiraSearchAll(fallbackJql, maxTotal);
  }

  if (!results) {
    console.error("Query failed completely");
    return [];
  }

  console.error(`Found ${results.length} issues`);
  return results.map(extract);
}

async function main() {
  const output = {};

  // Query 1: Last 100 integration issues
  output.allIntegrations = await runQuery(
    "All Integration Issues (last 100)",
    "project = YSHUB AND component = Integration ORDER BY created DESC"
  );

  // Query 2: High severity (all)
  output.highSeverity = await runQuery(
    "High Severity Integration Issues",
    "project = YSHUB AND priority in (Highest, High) AND component = Integration ORDER BY created DESC"
  );

  // Query 3: Last 30 days (all)
  output.last30Days = await runQuery(
    "Last 30 Days Integration Issues",
    "project = YSHUB AND created >= -30d AND component = Integration ORDER BY created DESC"
  );

  // Query 4: Open/unresolved (all)
  output.openIssues = await runQuery(
    "Open/Unresolved Integration Issues",
    "project = YSHUB AND status not in (Done, Closed) AND component = Integration ORDER BY priority DESC"
  );

  // Summary counts
  console.error("\n=== Summary ===");
  console.error(`All integrations: ${output.allIntegrations.length}`);
  console.error(`High severity: ${output.highSeverity.length}`);
  console.error(`Last 30 days: ${output.last30Days.length}`);
  console.error(`Open issues: ${output.openIssues.length}`);

  // Output JSON to stdout
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
