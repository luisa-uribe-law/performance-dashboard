"use client";

import { useState, useEffect } from "react";
import { LeakageData } from "@/lib/types";
import { formatMonth } from "@/lib/format";

const JIRA_BROWSE = "https://yunopayments.atlassian.net/browse";

interface Props {
  from: string; // "2026-01"
  to: string;   // "2026-03"
  onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function leakageColor(days: number): string {
  if (days <= 7) return "var(--danger)";
  if (days <= 30) return "var(--warning)";
  return "var(--muted)";
}

function leakageLabel(days: number): string {
  if (days === 0) return "Same day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default function BugLeakageView({ from, to, onBack }: Props) {
  const [data, setData] = useState<LeakageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/leakage?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [from, to]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--muted)] mt-3">Loading bug leakage data from Jira...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-sm text-[var(--danger)]">Failed to load leakage data: {error}</p>
        <button onClick={onBack} className="mt-3 text-sm text-[var(--accent)] hover:underline">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-light)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Bug Leakage</h2>
          <p className="text-[11px] text-[var(--muted)]">
            {formatMonth(from)} — {formatMonth(to)} &middot; Time from deployment to first bug report
          </p>
        </div>
        {data.skippedNonRoster > 0 && (
          <span className="ml-auto text-[10px] text-[var(--muted-dim)] bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1">
            {data.skippedNonRoster} task{data.skippedNonRoster !== 1 ? "s" : ""} excluded (not in team roster)
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
          <div className="text-lg font-bold text-[var(--accent)]">{data.totalIntegrations}</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Completed</div>
          <div className="text-[9px] text-[var(--muted-dim)] mt-0.5">Integrations & features deployed</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
          <div className="text-lg font-bold text-[var(--danger)]">{data.integrationsWithBugs}</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">With Bugs</div>
          <div className="text-[9px] text-[var(--muted-dim)] mt-0.5">Had at least one bug reported</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
          <div className="text-lg font-bold text-[var(--success)]">{data.bugFreeRate}%</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Bug-Free Rate</div>
          <div className="text-[9px] text-[var(--muted-dim)] mt-0.5">Deployed without any bugs</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
          <div className="text-lg font-bold text-[var(--danger)]">{data.totalBugs}</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Total Bugs</div>
          <div className="text-[9px] text-[var(--muted-dim)] mt-0.5">YSHUB bugs linked to these tasks</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
          <div className="text-lg font-bold text-[var(--warning)]">{data.avgLeakageDays !== null ? `${data.avgLeakageDays}d` : "—"}</div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Avg Leakage</div>
          <div className="text-[9px] text-[var(--muted-dim)] mt-0.5">Avg days from deploy to first bug</div>
        </div>
      </div>

      {/* Integrations with bugs */}
      {data.integrations.filter(i => i.bugs.length > 0).length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--danger)] mb-3">
            Integrations with Bug Leakage ({data.integrationsWithBugs})
          </div>
          <div className="space-y-3">
            {data.integrations.filter(i => i.bugs.length > 0).map(integration => (
              <div key={integration.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                {/* Integration header */}
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/50">
                  <div className="flex items-center gap-2">
                    <a href={`${JIRA_BROWSE}/${integration.key}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[12px] text-[var(--accent)] hover:underline font-bold">
                      {integration.key}
                    </a>
                    <span className="text-[12px] text-[var(--foreground)] font-medium truncate">{integration.summary}</span>
                    <span className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[var(--muted)]">{integration.assignee}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--muted)]">
                    <span>Deployed: <strong className="text-[var(--foreground)]">{formatDate(integration.deployedDate)}</strong></span>
                    <span>&middot;</span>
                    <span className="text-[var(--danger)]">{integration.bugs.length} bug{integration.bugs.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {/* Bugs list */}
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[var(--surface)]">
                      <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Bug</th>
                      <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                      <th className="py-1.5 px-4 text-right text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Reported</th>
                      <th className="py-1.5 px-4 text-right text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Leakage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integration.bugs.map(bug => (
                      <tr key={bug.key} className="border-t border-[var(--border)]">
                        <td className="py-1.5 px-4 font-mono">
                          <a href={`${JIRA_BROWSE}/${bug.key}`} target="_blank" rel="noopener noreferrer"
                            className="text-[var(--danger)] hover:underline">{bug.key}</a>
                        </td>
                        <td className="py-1.5 px-4 text-[var(--foreground)] truncate max-w-[300px]">{bug.summary}</td>
                        <td className="py-1.5 px-4 text-right text-[var(--muted)] tabular-nums">{formatDate(bug.createdDate)}</td>
                        <td className="py-1.5 px-4 text-right">
                          <span className="font-bold tabular-nums" style={{ color: leakageColor(bug.daysSinceDeployment) }}>
                            {leakageLabel(bug.daysSinceDeployment)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bug-free integrations */}
      {data.integrations.filter(i => i.bugs.length === 0).length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--success)] mb-3">
            Bug-Free Integrations ({data.integrations.filter(i => i.bugs.length === 0).length})
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--surface)]">
                  <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                  <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                  <th className="py-1.5 px-4 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Assignee</th>
                  <th className="py-1.5 px-4 text-right text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {data.integrations.filter(i => i.bugs.length === 0).map(i => (
                  <tr key={i.key} className="border-t border-[var(--border)]">
                    <td className="py-1.5 px-4 font-mono">
                      <a href={`${JIRA_BROWSE}/${i.key}`} target="_blank" rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline">{i.key}</a>
                    </td>
                    <td className="py-1.5 px-4 text-[var(--foreground)] truncate max-w-[250px]">{i.summary}</td>
                    <td className="py-1.5 px-4 text-[var(--muted)]">{i.assignee}</td>
                    <td className="py-1.5 px-4 text-right text-[var(--muted)] tabular-nums">{formatDate(i.deployedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
