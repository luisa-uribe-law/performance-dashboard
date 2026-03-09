import { PerformanceData, GroupFilter, DeveloperMonthly, MonthlyTeamMetrics, OnCallPriorityMetrics, Developer, BugTicket } from "./types";
import { syncMonth, getRosterForMonth, SyncResult } from "./jira";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");

// ── In-memory cache ──
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: SyncResult;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
let lastRosterMtime = 0;

export function clearCache() {
  cache.clear();
}

function checkRosterChanged(): boolean {
  try {
    const rosterPath = path.join(DATA_DIR, "roster.json");
    const stat = fs.statSync(rosterPath);
    const mtime = stat.mtimeMs;
    if (mtime !== lastRosterMtime) {
      lastRosterMtime = mtime;
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

// ── Read cached JSON file for a month ──

function readCachedMonth(month: string): SyncResult | null {
  try {
    const filePath = path.join(DATA_DIR, `sync-${month}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SyncResult;
  } catch {
    return null;
  }
}

// ── Write cached JSON file for a month ──

export function writeCachedMonth(month: string, data: SyncResult): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, `sync-${month}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
}

// ── Get month data: cache → file → Jira API ──

async function getSyncedMonth(month: string): Promise<SyncResult> {
  // 1. In-memory cache
  const cached = cache.get(month);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. On-disk JSON cache
  const fromFile = readCachedMonth(month);
  if (fromFile) {
    cache.set(month, { data: fromFile, fetchedAt: Date.now() });
    return fromFile;
  }

  // 3. Live Jira sync (fallback)
  const data = await syncMonth(month);
  cache.set(month, { data, fetchedAt: Date.now() });
  // Persist to disk so next request is instant
  try { writeCachedMonth(month, data); } catch { /* non-fatal */ }
  return data;
}

// ── Available months ──

function getAvailableMonthsList(): string[] {
  const now = new Date();
  const months: string[] = [];
  let y = 2026;
  let m = 1;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── Main loader ──

export async function loadPerformanceData(): Promise<PerformanceData> {
  if (checkRosterChanged()) {
    clearCache();
  }

  const months = getAvailableMonthsList();
  const results = await Promise.all(months.map(m => getSyncedMonth(m)));

  const teamMetrics: MonthlyTeamMetrics[] = [];
  const developerMetrics: DeveloperMonthly[] = [];
  const onCallPriority: OnCallPriorityMetrics[] = [];
  const yshubBugs: BugTicket[] = [];
  const developerSet = new Map<string, Developer>();

  for (const result of results) {
    teamMetrics.push(result.teamMetrics);
    developerMetrics.push(...result.developerMetrics);
    onCallPriority.push(...result.onCallPriority);
    for (const bug of result.yshubBugs) {
      yshubBugs.push({ ...bug, month: result.month });
    }

    const roster = getRosterForMonth(result.month);
    for (const entry of roster) {
      if (!developerSet.has(entry.displayName)) {
        developerSet.set(entry.displayName, {
          name: entry.displayName,
          group: entry.group,
        });
      }
    }
  }

  return {
    teamMetrics,
    developerMetrics,
    onCallPriority,
    developers: Array.from(developerSet.values()),
    yshubBugs,
  };
}

// ── Helpers ──

export function getAvailableMonths(data: PerformanceData): string[] {
  return [...new Set(data.teamMetrics.map(m => m.month))].sort();
}

export function filterByMonth(data: PerformanceData, month: string): {
  team: MonthlyTeamMetrics | undefined;
  developers: DeveloperMonthly[];
  onCallPriority: OnCallPriorityMetrics[];
} {
  return {
    team: data.teamMetrics.find(m => m.month === month),
    developers: data.developerMetrics.filter(m => m.month === month),
    onCallPriority: data.onCallPriority.filter(m => m.month === month),
  };
}

export function filterByGroup(devMetrics: DeveloperMonthly[], group: GroupFilter): DeveloperMonthly[] {
  if (group === "all") return devMetrics;
  return devMetrics.filter(d => d.group === group);
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${year}`;
}

export function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[parseInt(m) - 1]} ${year}`;
}
