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
    // The /api/sync route already writes to data/sync-YYYY-MM.json,
    // but let's also verify/write here as a safety net
    writeFileSync(`${dataDir}/sync-${month}.json`, JSON.stringify(data));
    const devCount = data.developerMetrics?.length || 0;
    const tickets = data.teamMetrics?.ticketsResolved || 0;
    console.log(`  ✓ ${month}: ${devCount} developers, ${tickets} tickets`);
  } catch (err) {
    console.error(`  ERROR ${month}: ${err.message}`);
    hasErrors = true;
  }
}

server.close();
console.log(hasErrors ? "\nCompleted with errors." : "\nAll months synced successfully.");
process.exit(hasErrors ? 1 : 0);
