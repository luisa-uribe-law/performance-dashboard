/**
 * Sync all months from Jira and write cached JSON files to data/.
 * Used by GitHub Actions daily cron and can be run manually.
 *
 * Requires env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";

// Build the project first so we can use the compiled sync module
console.log("Building project...");
execSync("npx next build", { stdio: "inherit" });

// Determine months to sync (Jan 2026 → current month)
const now = new Date();
const months = [];
let y = 2026, m = 1;
while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
  months.push(`${y}-${String(m).padStart(2, "0")}`);
  m++;
  if (m > 12) { m = 1; y++; }
}

console.log(`Syncing ${months.length} months: ${months.join(", ")}`);

// We can't easily import the TS modules directly, so we'll use the built API.
// Start the server temporarily and call /api/sync for each month.

import { createServer } from "http";
import { parse } from "url";

// Dynamic import of the Next.js handler
const next = (await import("next")).default;
const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => handle(req, res, parse(req.url, true)));

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
console.log(`Temporary server on port ${port}`);

const dataDir = "data";
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

let hasErrors = false;

// Debug: verify Jira credentials work before syncing
console.log(`Debug: JIRA_EMAIL='${process.env.JIRA_EMAIL}' (${(process.env.JIRA_EMAIL || '').length} chars)`);
console.log(`Debug: JIRA_API_TOKEN length=${(process.env.JIRA_API_TOKEN || '').length}, first4='${(process.env.JIRA_API_TOKEN || '').slice(0,4)}', last4='${(process.env.JIRA_API_TOKEN || '').slice(-4)}'`);
console.log(`Debug: JIRA_BASE_URL='${process.env.JIRA_BASE_URL}'`);
const jiraAuth = "Basic " + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString("base64");
try {
  const meResp = await fetch(`${process.env.JIRA_BASE_URL}/rest/api/3/myself`, {
    headers: { Authorization: jiraAuth, "Content-Type": "application/json" }
  });
  if (meResp.ok) {
    const me = await meResp.json();
    console.log(`Jira auth OK: ${me.displayName} (${me.emailAddress})`);
  } else {
    console.error(`Jira auth FAILED: ${meResp.status} ${(await meResp.text()).slice(0, 200)}`);
    process.exit(1);
  }
  // Test a simple query
  const testJql = `project = DEM AND issuetype = Epic AND status in (Done, "Implementation Complete") AND created >= "2026-01-01"`;
  const testResp = await fetch(`${process.env.JIRA_BASE_URL}/rest/api/3/search/jql?${new URLSearchParams({ jql: testJql, maxResults: "1", fields: "summary" })}`, {
    headers: { Authorization: jiraAuth, "Content-Type": "application/json" }
  });
  if (testResp.ok) {
    const testData = await testResp.json();
    console.log(`Jira test query: ${testData.issues?.length ?? 0} issues found (expected >= 0)`);
  } else {
    console.error(`Jira test query FAILED: ${testResp.status} ${(await testResp.text()).slice(0, 200)}`);
  }
} catch (err) {
  console.error(`Jira connectivity error: ${err.message}`);
  process.exit(1);
}

for (const month of months) {
  try {
    console.log(`  Syncing ${month}...`);
    const resp = await fetch(`http://localhost:${port}/api/sync?month=${month}`);
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`  ERROR ${month}: ${resp.status} ${body.slice(0, 200)}`);
      hasErrors = true;
      continue;
    }
    const data = await resp.json();
    const devCount = data.developerMetrics?.length || 0;
    const tasks = data.teamMetrics?.tasksCompleted || 0;
    const tickets = data.teamMetrics?.ticketsResolved || 0;

    // Safety check: don't overwrite existing data with empty results
    if (tasks === 0 && tickets === 0 && existsSync(`${dataDir}/sync-${month}.json`)) {
      console.warn(`  ⚠ ${month}: sync returned 0 tasks and 0 tickets — keeping existing file`);
      console.warn(`    Debug: ${JSON.stringify(data.debug || {})}`);
      console.warn(`    ActiveDevs: ${data.teamMetrics?.activeDevelopers}, DevMetrics count: ${data.developerMetrics?.length}`);
      hasErrors = true;
      continue;
    }

    writeFileSync(`${dataDir}/sync-${month}.json`, JSON.stringify(data));
    console.log(`  ✓ ${month}: ${devCount} developers, ${tasks} tasks, ${tickets} tickets`);
  } catch (err) {
    console.error(`  ERROR ${month}: ${err.message}`);
    hasErrors = true;
  }
}

server.close();
console.log(hasErrors ? "\nCompleted with errors." : "\nAll months synced successfully.");
process.exit(hasErrors ? 1 : 0);
