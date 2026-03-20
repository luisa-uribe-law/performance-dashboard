"use client";

import { useState, useEffect, useMemo } from "react";
import { TimeBlockedMonthly, TimeBlockedTicket } from "@/lib/types";
import { formatMonth } from "@/lib/format";
import SectionCard from "./SectionCard";
import TrendChart from "./TrendChart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

const JIRA_BROWSE = "https://yunopayments.atlassian.net/browse";

// Yuno-palette colors
const CATEGORY_COLORS = {
  active: "#5A6AEE",    // Yuno blue-light
  blocked: "#C8CBE0",   // Yuno border-light
  queue: "#9498B5",     // Yuno muted-dim (back-to-queue after active)
  done: "#3E4FE0",
};

const CATEGORY_LABELS = {
  active: "Actively Worked (In Progress)",
  blocked: "Blocked / On Hold",
  queue: "Returned to Queue (after started)",
  done: "Done",
};

interface Props {
  months: string[];
  onBack: () => void;
}

function KpiBox({ label, value, subtitle, color }: { label: string; value: string; subtitle?: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
      <div className="text-2xl font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[11px] font-medium text-[var(--foreground)] mt-1">{label}</div>
      {subtitle && <div className="text-[10px] text-[var(--muted)] mt-0.5">{subtitle}</div>}
    </div>
  );
}

function PhaseBar({ ticket }: { ticket: TimeBlockedTicket }) {
  // Use the ticket's computed active/blocked values directly (consistent with %)
  const active = ticket.activeTimeDays;
  const blocked = ticket.blockedTimeDays;
  const total = active + blocked;
  if (total <= 0) return null;

  const segments = [
    { label: "Actively Worked", days: active, color: CATEGORY_COLORS.active },
    { label: "Blocked", days: blocked, color: "#E8A0A0" },
  ].filter(s => s.days > 0);

  return (
    <div className="flex h-5 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full"
          style={{
            width: `${Math.max(2, (s.days / total) * 100)}%`,
            backgroundColor: s.color,
          }}
          title={`${s.label}: ${Math.round(s.days * 10) / 10}d (${Math.round(s.days / total * 100)}%)`}
        />
      ))}
    </div>
  );
}

export default function TimeBlockedView({ months, onBack }: Props) {
  const [data, setData] = useState<TimeBlockedMonthly[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"blocked" | "blockedPct" | "cycle" | "active" | "name">("blockedPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Always fetch all available months so we have 3-month trend
  const allMonthsToFetch = useMemo(() => {
    // Ensure we always have at least the last 3 months for the trend line
    const now = new Date();
    const threeMonths: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      threeMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const allSet = new Set([...months, ...threeMonths]);
    return [...allSet].sort();
  }, [months]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/time-blocked?months=${allMonthsToFetch.join(",")}`)
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((d: TimeBlockedMonthly[]) => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [allMonthsToFetch]);

  function med(arr: number[]) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // All tickets from selected months only
  const rawTickets = useMemo(() => {
    if (!data) return [];
    const monthSet = new Set(months);
    return data.filter(m => monthSet.has(m.month)).flatMap(m => m.tickets);
  }, [data, months]);

  // Outlier fences (IQR method) — flag both excessive blocked time AND excessive cycle time
  const { blockedFence, cycleFence } = useMemo(() => {
    const n = rawTickets.length;
    if (n < 4) return { blockedFence: Infinity, cycleFence: Infinity };
    const sortedBlocked = rawTickets.map(t => t.blockedTimeDays).sort((a, b) => a - b);
    const bq1 = sortedBlocked[Math.floor(n * 0.25)];
    const bq3 = sortedBlocked[Math.floor(n * 0.75)];
    const sortedCycle = rawTickets.map(t => t.leadTimeDays).sort((a, b) => a - b);
    const cq1 = sortedCycle[Math.floor(n * 0.25)];
    const cq3 = sortedCycle[Math.floor(n * 0.75)];
    return {
      blockedFence: bq3 + 1.5 * (bq3 - bq1),
      cycleFence: cq3 + 1.5 * (cq3 - cq1),
    };
  }, [rawTickets]);

  const outlierKeys = useMemo(() => {
    return new Set(rawTickets.filter(t => t.blockedTimeDays > blockedFence || t.leadTimeDays > cycleFence).map(t => t.key));
  }, [rawTickets, blockedFence, cycleFence]);

  // Always exclude outliers from metrics
  const filteredTickets = useMemo(() => {
    return rawTickets.filter(t => !outlierKeys.has(t.key));
  }, [rawTickets, outlierKeys]);

  const totals = useMemo(() => {
    if (!data || data.length === 0) return null;
    const n = filteredTickets.length;
    if (n === 0) return { totalTasks: 0, avgCycle: 0, avgActive: 0, avgBlocked: 0, avgBlockedPct: 0, medCycle: 0, medActive: 0, medBlocked: 0, medBlockedPct: 0, outlierCount: outlierKeys.size, totalRaw: rawTickets.length };

    return {
      totalTasks: n,
      totalRaw: rawTickets.length,
      avgCycle: Math.round(filteredTickets.reduce((s, t) => s + t.leadTimeDays, 0) / n * 10) / 10,
      avgActive: Math.round(filteredTickets.reduce((s, t) => s + t.activeTimeDays, 0) / n * 10) / 10,
      avgBlocked: Math.round(filteredTickets.reduce((s, t) => s + t.blockedTimeDays, 0) / n * 10) / 10,
      avgBlockedPct: Math.round(filteredTickets.reduce((s, t) => s + t.blockedPct, 0) / n * 10) / 10,
      medCycle: Math.round(med(filteredTickets.map(t => t.leadTimeDays)) * 10) / 10,
      medActive: Math.round(med(filteredTickets.map(t => t.activeTimeDays)) * 10) / 10,
      medBlocked: Math.round(med(filteredTickets.map(t => t.blockedTimeDays)) * 10) / 10,
      medBlockedPct: Math.round(med(filteredTickets.map(t => t.blockedPct)) * 10) / 10,
      outlierCount: outlierKeys.size,
    };
  }, [data, filteredTickets, rawTickets, outlierKeys]);

  // Last 3 months trend data (always from allMonthsToFetch, excl outliers)
  const last3Trend = useMemo(() => {
    if (!data) return [];
    // Get all outlier keys across all months
    const allRaw = data.flatMap(m => m.tickets);
    const allOutlierKeys = new Set<string>();
    if (allRaw.length >= 4) {
      const n = allRaw.length;
      const sortedBlocked = allRaw.map(t => t.blockedTimeDays).sort((a, b) => a - b);
      const bq1 = sortedBlocked[Math.floor(n * 0.25)];
      const bq3 = sortedBlocked[Math.floor(n * 0.75)];
      const bFence = bq3 + 1.5 * (bq3 - bq1);
      const sortedCycle = allRaw.map(t => t.leadTimeDays).sort((a, b) => a - b);
      const cq1 = sortedCycle[Math.floor(n * 0.25)];
      const cq3 = sortedCycle[Math.floor(n * 0.75)];
      const cFence = cq3 + 1.5 * (cq3 - cq1);
      for (const t of allRaw) { if (t.blockedTimeDays > bFence || t.leadTimeDays > cFence) allOutlierKeys.add(t.key); }
    }

    return data.map(m => {
      const tickets = m.tickets.filter(t => !allOutlierKeys.has(t.key));
      const n = tickets.length;
      return {
        month: m.month,
        avgBlockedPct: n > 0 ? Math.round(tickets.reduce((s, t) => s + t.blockedPct, 0) / n * 10) / 10 : 0,
        avgCycleDays: n > 0 ? Math.round(tickets.reduce((s, t) => s + t.leadTimeDays, 0) / n * 10) / 10 : 0,
        avgBlockedDays: n > 0 ? Math.round(tickets.reduce((s, t) => s + t.blockedTimeDays, 0) / n * 10) / 10 : 0,
        tasks: n,
      };
    }).sort((a, b) => a.month.localeCompare(b.month)).slice(-3); // last 3
  }, [data]);

  // Sorted tickets — #3: always sorted by blocked time desc by default, shows ALL (including outliers)
  const sortedTickets = useMemo(() => {
    const sorted = [...rawTickets];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "blockedPct": cmp = a.blockedPct - b.blockedPct; break;
        case "blocked": cmp = a.blockedTimeDays - b.blockedTimeDays; break;
        case "cycle": cmp = a.leadTimeDays - b.leadTimeDays; break;
        case "active": cmp = a.activeTimeDays - b.activeTimeDays; break;
        case "name": cmp = a.summary.localeCompare(b.summary); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [rawTickets, sortBy, sortDir]);

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function downloadExcel() {
    const rows = sortedTickets.map(t => ({
      "Ticket": t.key,
      "Link": `${JIRA_BROWSE}/${t.key}`,
      "Summary": t.summary,
      "Developer": t.developer,
      "Weight": t.weight,
      "Started (First In Progress)": t.createdDate,
      "Completed": t.completedDate,
      "Cycle Time (days)": t.leadTimeDays,
      "Active Time (days)": t.activeTimeDays,
      "Blocked Time (days)": t.blockedTimeDays,
      "% Blocked": t.blockedPct,
      "Outlier": outlierKeys.has(t.key) ? "Yes" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Time Blocked");
    XLSX.writeFile(wb, `time-blocked-${months.join("-")}.xlsx`);
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <span className="text-[var(--muted)] ml-0.5">&#x2195;</span>;
    return <span className="text-[var(--accent)] ml-0.5">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="text-[var(--muted)] text-sm">Fetching changelog data from Jira...</span>
          <span className="text-[var(--muted)] text-xs">This may take a moment for the first load</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-6 text-center">
          <div className="text-[var(--danger)] font-medium mb-1">Failed to load time-blocked data</div>
          <div className="text-[var(--muted)] text-sm">{error}</div>
          <button onClick={onBack} className="mt-3 text-sm text-[var(--accent)] hover:underline">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Donut data — use avgBlockedPct so it matches the KPI (average of per-ticket %)
  const donutData = totals && totals.totalTasks > 0 ? (() => {
    const blockedPct = totals.avgBlockedPct;
    const activePct = Math.round((100 - blockedPct) * 10) / 10;
    const pieData = [
      { name: "Actively Worked", value: activePct, color: CATEGORY_COLORS.active },
      { name: "Blocked / On Hold", value: blockedPct, color: "#E8A0A0" },
    ].filter(d => d.value > 0);
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
    return { pieData, pieTotal };
  })() : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Time Blocked Analysis</h2>
          <p className="text-xs text-[var(--muted)]">
            How long each completed integration spent blocked vs. being actively worked &middot; {months.map(formatMonth).join(" \u2014 ")}
            {months.some(m => {
              const now = new Date();
              return m === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            }) && <span className="ml-1 text-[var(--warning)] font-medium">(partial month &mdash; data through today)</span>}
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Dashboard
        </button>
      </div>

      {/* ── KPI Cards ── */}
      {totals && totals.totalTasks > 0 && (
        <>
          {/* Outlier notice */}
          {totals.outlierCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm1-3.5a.75.75 0 01-1.5 0v-4a.75.75 0 011.5 0v4z"/></svg>
              <span>{totals.outlierCount} statistical outlier{totals.outlierCount > 1 ? "s" : ""} excluded from averages below ({totals.totalTasks} of {totals.totalRaw} tasks shown). Outliers are still listed in the table, highlighted in red.</span>
            </div>
          )}

          <div>
            <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
              Averages (outliers excluded) &middot; {totals.totalTasks} completed integrations
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiBox
                label="Completed Integrations"
                value={`${totals.totalTasks}`}
                subtitle={totals.outlierCount > 0 ? `${totals.outlierCount} outlier${totals.outlierCount !== 1 ? "s" : ""} excluded` : undefined}
                color="var(--accent)"
              />
              <KpiBox
                label="Avg Cycle Time"
                value={`${totals.avgCycle}d`}
                subtitle={`Working days \u00B7 In Progress \u2192 Done \u00B7 median: ${totals.medCycle}d`}
                color="var(--accent)"
              />
              <KpiBox
                label="Avg Actively Worked"
                value={`${totals.avgActive}d`}
                subtitle={`In Progress phases \u00B7 median: ${totals.medActive}d`}
                color="#5A6AEE"
              />
              <KpiBox
                label="Avg Blocked / On Hold"
                value={`${totals.avgBlocked}d`}
                subtitle={`Blocked statuses only \u00B7 median: ${totals.medBlocked}d`}
                color="#E8A0A0"
              />
              <KpiBox
                label="Avg % Blocked"
                value={`${totals.avgBlockedPct}%`}
                subtitle={`Of cycle time \u00B7 median: ${totals.medBlockedPct}%`}
                color="#E8A0A0"
              />
            </div>
          </div>
        </>
      )}

      {/* ── #2: Distribution — Left: 3-month trend, Right: donut ── */}
      {totals && totals.totalTasks > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: 3-month trend line */}
          <SectionCard title="3-Month Trend" subtitle="Avg cycle time and blocked time in working days over the last 3 months (outliers excluded)">
            {last3Trend.length > 0 ? (
              <>
                <TrendChart
                  data={last3Trend}
                  xKey="month"
                  lines={[
                    { key: "avgCycleDays", color: "var(--accent)", name: "Avg Cycle Time (days)" },
                    { key: "avgBlockedDays", color: "var(--danger)", name: "Avg Blocked (days)" },
                  ]}
                  yFormatter={(v) => `${v}d`}
                  height={200}
                />
                <div className="flex items-center gap-4 mt-2 text-[9px] text-[var(--muted)]">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#3E4FE0" }} />Avg Cycle Time</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#E8A0A0" }} />Avg Blocked Time</span>
                </div>
                {/* Monthly summary underneath */}
                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
                  {last3Trend.map(m => {
                    const now = new Date();
                    const isCurrentMonth = m.month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    return (
                      <div key={m.month} className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--foreground)] font-medium">
                          {formatMonth(m.month)}{isCurrentMonth && <span className="text-[var(--warning)] ml-1 text-[9px]">(partial)</span>}
                        </span>
                        <span className="text-[var(--muted)] tabular-nums">
                          {m.tasks} tasks &middot; {m.avgCycleDays}d cycle &middot; {m.avgBlockedDays}d blocked &middot; {m.avgBlockedPct}% blocked
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-[var(--muted)] text-sm">Not enough data for trend</div>
            )}
          </SectionCard>

          {/* Right: donut chart */}
          {donutData && (
            <SectionCard title="Average Time Distribution" subtitle={`How the avg ${totals.avgCycle}d cycle time breaks down (In Progress \u2192 Done)`}>
              <div className="flex items-center gap-8">
                <div className="relative w-[180px] h-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        animationDuration={800}
                        stroke="none"
                      >
                        {donutData.pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E2EE", borderRadius: 10, fontSize: 12, color: "#282A30", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [`${Math.round(value as number)}%`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-xl font-bold text-[var(--foreground)]">{totals.avgCycle}d</div>
                    <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider">Cycle Time</div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  {donutData.pieData.map(d => {
                    const pct = Math.round(d.value);
                    const days = d.name.includes("Active") ? totals.avgActive : totals.avgBlocked;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-[12px] font-medium text-[var(--foreground)]">{d.name}</span>
                          </div>
                          <span className="text-[12px] font-bold tabular-nums" style={{ color: d.color }}>{pct}% ({days}d avg)</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Per-Integration Table ── */}
      <SectionCard
        title="All Completed Integrations"
        subtitle={`${rawTickets.length} tasks total \u00B7 sorted by ${sortBy === "blockedPct" ? "% blocked" : sortBy === "blocked" ? "blocked time" : sortBy === "cycle" ? "cycle time" : sortBy === "active" ? "active time" : "name"} (${sortDir === "desc" ? "highest" : "lowest"} first)${outlierKeys.size > 0 ? ` \u00B7 ${outlierKeys.size} outlier${outlierKeys.size > 1 ? "s" : ""} highlighted` : ""}`}
        action={
          <button onClick={downloadExcel} className="text-[10px] font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Excel
          </button>
        }
      >
        {rawTickets.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">No completed integration tasks found for this period</div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[70px_1fr_100px_80px_70px_70px_75px_160px] gap-2 text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2 mb-1">
              <div>Ticket</div>
              <button onClick={() => handleSort("name")} className="text-left flex items-center hover:text-[var(--foreground)]">Summary <SortIcon col="name" /></button>
              <div>Developer</div>
              <button onClick={() => handleSort("cycle")} className="text-right flex items-center justify-end hover:text-[var(--foreground)]">Cycle Time <SortIcon col="cycle" /></button>
              <button onClick={() => handleSort("active")} className="text-right flex items-center justify-end hover:text-[var(--foreground)]">Active <SortIcon col="active" /></button>
              <button onClick={() => handleSort("blocked")} className="text-right flex items-center justify-end hover:text-[var(--foreground)]">Blocked <SortIcon col="blocked" /></button>
              <button onClick={() => handleSort("blockedPct")} className="text-right flex items-center justify-end hover:text-[var(--foreground)]">% Blocked <SortIcon col="blockedPct" /></button>
              <div>Phase Timeline</div>
            </div>

            {/* Rows */}
            <div className="max-h-[500px] overflow-y-auto pr-1">
              {sortedTickets.map(t => {
                const isOutlier = outlierKeys.has(t.key);
                return (
                <div
                  key={t.key}
                  className={`grid grid-cols-[70px_1fr_100px_80px_70px_70px_75px_160px] gap-2 items-center py-2 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors text-[11px] ${isOutlier ? "bg-[var(--danger)]/6 border-l-2 border-l-[var(--danger)]/40" : ""}`}
                >
                  {/* #4: Ticket key without outlier badge (badge goes after summary) */}
                  <a
                    href={`${JIRA_BROWSE}/${t.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-medium text-[var(--accent)] hover:underline truncate"
                  >
                    {t.key}
                  </a>
                  {/* Summary + outlier badge after description */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-[var(--foreground)]" title={t.summary}>{t.summary}</span>
                    {isOutlier && <span className="text-[8px] font-bold text-white bg-[var(--danger)] rounded px-1 py-0.5 shrink-0 uppercase">Outlier</span>}
                  </div>
                  <div className="truncate text-[var(--muted)]">{t.developer}</div>
                  <div className="text-right tabular-nums font-medium">{t.leadTimeDays}d</div>
                  <div className="text-right tabular-nums" style={{ color: CATEGORY_COLORS.active }}>{t.activeTimeDays}d</div>
                  <div className="text-right tabular-nums font-medium" style={{ color: t.blockedTimeDays > t.activeTimeDays ? "#E8A0A0" : CATEGORY_COLORS.active }}>
                    {t.blockedTimeDays}d
                  </div>
                  <div className="text-right tabular-nums text-[10px] font-medium" style={{ color: t.blockedPct > 70 ? "#E8A0A0" : t.blockedPct > 50 ? "var(--muted)" : CATEGORY_COLORS.active }}>
                    {t.blockedPct}%
                  </div>
                  <PhaseBar ticket={t} />
                </div>
                );
              })}
            </div>

            {/* Summary footer */}
            <div className="mt-3 pt-3 border-t-2 border-[var(--border)] grid grid-cols-[70px_1fr_100px_80px_70px_70px_75px_160px] gap-2 text-[10px] font-bold uppercase tracking-wider">
              <div></div>
              <div className="text-[var(--foreground)]">
                Averages ({filteredTickets.length} tasks, outliers excluded)
              </div>
              <div></div>
              <div className="text-right text-[var(--foreground)]">{totals?.avgCycle}d</div>
              <div className="text-right" style={{ color: CATEGORY_COLORS.active }}>{totals?.avgActive}d</div>
              <div className="text-right" style={{ color: "#E8A0A0" }}>{totals?.avgBlocked}d</div>
              <div className="text-right text-[var(--foreground)]">{totals?.avgBlockedPct}%</div>
              <div></div>
            </div>
            <div className="grid grid-cols-[70px_1fr_100px_80px_70px_70px_75px_160px] gap-2 text-[10px] text-[var(--muted)] uppercase tracking-wider">
              <div></div>
              <div>Medians</div>
              <div></div>
              <div className="text-right">{totals?.medCycle}d</div>
              <div className="text-right">{totals?.medActive}d</div>
              <div className="text-right">{totals?.medBlocked}d</div>
              <div className="text-right">{totals?.medBlockedPct}%</div>
              <div></div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
