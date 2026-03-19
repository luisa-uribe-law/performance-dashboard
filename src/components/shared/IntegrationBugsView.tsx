"use client";

import { useState, useMemo } from "react";
import { BugTicket } from "@/lib/types";
import { formatMonth } from "@/lib/format";

interface Props {
  bugs: BugTicket[];
  onBack: () => void;
}

interface BugRow {
  key: string;
  summary: string;
  provider: string;
  env: "PROD" | "SBX" | "STG";
  reportingType: "Merchant" | "Team" | "Unknown";
  month: string;
}

interface ProviderGroup {
  provider: string;
  bugs: BugRow[];
}

const JIRA_BASE = "https://yunopayments.atlassian.net/browse";

const ENV_COLORS: Record<string, string> = {
  PROD: "var(--danger)",
  SBX: "var(--muted)",
  STG: "var(--accent)",
};

const RT_COLORS: Record<string, string> = {
  Merchant: "var(--muted)",
  Team: "var(--accent)",
  Unknown: "var(--muted-dim)",
};

function collectBugs(bugs: BugTicket[]): BugRow[] {
  return bugs.map(bug => ({
    key: bug.key,
    summary: bug.summary,
    provider: bug.provider || "Unknown",
    env: bug.env,
    reportingType: bug.reportingType || "Unknown",
    month: bug.month || "",
  }));
}

export default function IntegrationBugsView({ bugs, onBack }: Props) {
  const [providerFilter, setProviderFilter] = useState("all");
  const [envFilter, setEnvFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const allBugs = useMemo(() => collectBugs(bugs), [bugs]);

  const hasMultipleMonths = useMemo(() => {
    return new Set(allBugs.map(b => b.month)).size > 1;
  }, [allBugs]);

  const envCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allBugs) {
      counts[b.env] = (counts[b.env] || 0) + 1;
    }
    return counts;
  }, [allBugs]);

  const rtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allBugs) {
      counts[b.reportingType] = (counts[b.reportingType] || 0) + 1;
    }
    return counts;
  }, [allBugs]);

  const filtered = useMemo(() => {
    let bugs = allBugs;
    if (providerFilter !== "all") bugs = bugs.filter(b => b.provider === providerFilter);
    if (envFilter !== "all") bugs = bugs.filter(b => b.env === envFilter);
    return bugs;
  }, [allBugs, providerFilter, envFilter]);

  const providers = useMemo(() => [...new Set(allBugs.map(b => b.provider))].sort(), [allBugs]);

  const groups = useMemo(() => {
    const map = new Map<string, BugRow[]>();
    for (const bug of filtered) {
      if (!map.has(bug.provider)) map.set(bug.provider, []);
      map.get(bug.provider)!.push(bug);
    }
    const result: ProviderGroup[] = [];
    for (const [provider, bugs] of map) {
      result.push({
        provider,
        bugs: bugs.sort((a, b) => b.month.localeCompare(a.month)),
      });
    }
    return result.sort((a, b) => {
      const aUnknown = a.provider === "Unknown" ? 1 : 0;
      const bUnknown = b.provider === "Unknown" ? 1 : 0;
      if (aUnknown !== bUnknown) return aUnknown - bUnknown;
      return b.bugs.length - a.bugs.length;
    });
  }, [filtered]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5 animate-fade-in">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-light)] transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="text-base font-bold text-[var(--foreground)]">YSHUB Bugs by Provider</h2>

        <div className="flex-1" />

        {/* Environment filter */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
          <button
            onClick={() => setEnvFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              envFilter === "all" ? "bg-[var(--surface)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            All ({allBugs.length})
          </button>
          {(["PROD", "SBX", "STG"] as const).map(env => {
            const count = envCounts[env] || 0;
            if (count === 0) return null;
            const color = ENV_COLORS[env];
            return (
              <button
                key={env}
                onClick={() => setEnvFilter(envFilter === env ? "all" : env)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  envFilter === env ? "text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                style={envFilter === env ? { backgroundColor: color } : undefined}
              >
                {env} ({count})
              </button>
            );
          })}
        </div>

        {/* Provider filter */}
        <select
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
          className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer hover:border-[var(--border-light)] transition-colors"
        >
          <option value="all">All Providers ({providers.length})</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Counts + legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center">
          <div className="text-2xl font-bold text-[var(--oncall)]">{filtered.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mt-0.5">
            {envFilter === "all" ? "YSHUB Bugs" : `${envFilter} Bugs`}
          </div>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {groups.length} provider{groups.length !== 1 ? "s" : ""}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
          <span className="uppercase tracking-wider font-medium">Reported by</span>
          {(["Merchant", "Team", "Unknown"] as const).map(rt => {
            const count = rtCounts[rt] || 0;
            if (count === 0) return null;
            return (
              <span key={rt} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: RT_COLORS[rt] }} />
                {rt} ({count})
              </span>
            );
          })}
        </div>
      </div>

      {/* Provider groups */}
      <div className="space-y-1.5">
        {groups.length === 0 && (
          <div className="flex items-center justify-center h-40 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] text-sm">
            No bugs found for the selected filters
          </div>
        )}

        {groups.map(g => {
          const isOpen = expanded === g.provider;
          const prodCount = g.bugs.filter(b => b.env === "PROD").length;
          const sbxCount = g.bugs.filter(b => b.env === "SBX").length;
          const stgCount = g.bugs.filter(b => b.env === "STG").length;
          const merchantCount = g.bugs.filter(b => b.reportingType === "Merchant").length;
          const teamCount = g.bugs.filter(b => b.reportingType === "Team").length;
          const unknownRtCount = g.bugs.filter(b => b.reportingType === "Unknown").length;
          const maxBugs = groups[0]?.bugs.length || 1;
          const barPct = Math.max(4, (g.bugs.length / maxBugs) * 100);
          const merchantPct = g.bugs.length > 0 ? (merchantCount / g.bugs.length) * 100 : 0;
          const teamPct = g.bugs.length > 0 ? (teamCount / g.bugs.length) * 100 : 0;
          return (
            <div key={g.provider} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : g.provider)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--card-hover)] transition-colors text-left"
              >
                <svg
                  className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="w-32 shrink-0 text-sm font-semibold text-[var(--foreground)] truncate">{g.provider}</span>
                {/* Stacked bar by reporting type */}
                <div className="flex-1 h-5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]" style={{ maxWidth: `${barPct}%` }}>
                  <div className="h-full flex">
                    {merchantCount > 0 && (
                      <div className="h-full" style={{ width: `${merchantPct}%`, backgroundColor: RT_COLORS.Merchant }} title={`Merchant: ${merchantCount}`} />
                    )}
                    {teamCount > 0 && (
                      <div className="h-full" style={{ width: `${teamPct}%`, backgroundColor: RT_COLORS.Team }} title={`Team: ${teamCount}`} />
                    )}
                    {unknownRtCount > 0 && (
                      <div className="h-full" style={{ width: `${100 - merchantPct - teamPct}%`, backgroundColor: RT_COLORS.Unknown }} title={`Unknown: ${unknownRtCount}`} />
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {prodCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)" }}>
                      {prodCount} PROD
                    </span>
                  )}
                  {sbxCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)", color: "var(--warning)" }}>
                      {sbxCount} SBX
                    </span>
                  )}
                  {stgCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                      {stgCount} STG
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-[var(--muted)] shrink-0">{g.bugs.length}</span>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--border)]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                        <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                        <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Env</th>
                        <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Reported By</th>
                        {hasMultipleMonths && (
                          <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Month</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {g.bugs.map((bug, i) => {
                        const color = ENV_COLORS[bug.env] || ENV_COLORS.PROD;
                        return (
                          <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                            <td className="py-1.5 px-4 font-mono">
                              <a
                                href={`${JIRA_BASE}/${bug.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] hover:underline"
                              >
                                {bug.key}
                              </a>
                            </td>
                            <td className="py-1.5 px-3 text-[var(--foreground)]">{bug.summary}</td>
                            <td className="py-1.5 px-3 text-center">
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
                              >
                                {bug.env}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `color-mix(in srgb, ${RT_COLORS[bug.reportingType]} 20%, transparent)`, color: RT_COLORS[bug.reportingType] }}
                              >
                                {bug.reportingType}
                              </span>
                            </td>
                            {hasMultipleMonths && (
                              <td className="py-1.5 px-3 text-center text-[var(--muted)]">{formatMonth(bug.month)}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
