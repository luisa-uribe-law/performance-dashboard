"use client";

import { useMemo } from "react";
import { DeveloperMonthly } from "@/lib/types";
import { formatMonth } from "@/lib/format";
import TrendChart from "./TrendChart";

interface Props {
  developer: string;
  allMonths: DeveloperMonthly[];
  aggregated?: DeveloperMonthly; // pre-aggregated entry for multi-month/range mode
  onClose: () => void;
}

const JIRA_BROWSE = "https://yunopayments.atlassian.net/browse";

const squadLabels: Record<string, string> = {
  "the-hallows": "The Hallows",
  "mortifagos": "Mortifagos",
  "dementors": "Dementors",
  "dedicated-oncall": "Dedicated On-Call",
};


export default function DevProfileModal({ developer, allMonths, aggregated, onClose }: Props) {
  const latest = aggregated || allMonths[allMonths.length - 1];
  if (!latest) return null;

  const isAggregated = !!aggregated;

  const isPartialMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return latest.month === currentMonth;
  }, [latest.month]);
  const squad = squadLabels[latest.group] || latest.group;
  const initials = developer.split(" ").map(n => n[0]).join("").slice(0, 2);
  const isDedicatedOncall = latest.group === "dedicated-oncall";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-light)] bg-[var(--background)] shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-6 py-4 flex items-center gap-4 z-10">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-lg">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--foreground)]">{developer}</h2>
              {latest.deactivated && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--muted)]/15 text-[var(--muted)]">
                  Deactivated
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">{squad} &middot; {isAggregated ? `${formatMonth(allMonths[0]?.month || latest.month)} — ${formatMonth(allMonths[allMonths.length - 1]?.month || latest.month)}` : formatMonth(latest.month)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-white hover:border-[var(--border-light)] transition-colors">
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Integration Requests section ── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
              Integration Requests
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>{latest.tasksCompleted}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Tasks</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>{latest.weightedTasks}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Weighted Tasks</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: latest.prodBugs === 0 ? "var(--success)" : "var(--danger)" }}>{latest.prodBugs}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">PROD Bugs</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold text-[var(--muted)]">{latest.sbxBugs}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">SBX Bugs</div>
              </div>
            </div>
          </div>

          {/* ── On-Call Support section ── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--oncall)" }}>
              On-Call Support
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: "var(--oncall)" }}>{latest.ticketsResolved}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Tickets</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: latest.slaCompliancePct >= 80 ? "var(--success)" : latest.slaCompliancePct >= 50 ? "var(--warning)" : "var(--danger)" }}>{latest.slaCompliancePct}%</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">SLA</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                <div className="text-lg font-bold" style={{ color: "var(--oncall)" }}>{latest.medianResolutionHrs}h</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Median Time</div>
              </div>
            </div>
          </div>

          {/* Output Trend — ticket counts: DEM + On-Call + Total */}
          {allMonths.length > 1 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Output Trend (Tickets)</div>
              <TrendChart
                data={allMonths.map(d => ({
                  month: d.month,
                  integrations: d.tasksCompleted,
                  onCall: d.ticketsResolved,
                  total: d.tasksCompleted + d.ticketsResolved,
                }))}
                xKey="month"
                lines={[
                  { key: "integrations", color: "var(--accent)", name: "DEM Tickets" },
                  { key: "onCall", color: "var(--oncall)", name: "On-Call Tickets" },
                  { key: "total", color: "var(--success)", name: "Total" },
                ]}
                height={140}
                partialLast={isPartialMonth}
              />
            </div>
          )}

          {/* Integrations list — grouped by month in multi-month mode */}
          {latest.integrations.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                Integrations Worked On ({latest.integrations.length})
              </div>
              {(isAggregated ? allMonths : [latest]).map(md => {
                if (md.integrations.length === 0) return null;
                return (
                  <div key={`int-${md.month}`} className="mb-3">
                    {isAggregated && (
                      <div className="text-[11px] font-semibold text-[var(--accent)] mb-1">{formatMonth(md.month)}</div>
                    )}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-[var(--surface)]">
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                            <th className="py-1.5 px-3 text-right text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">WT</th>
                            <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">On-Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {md.integrations.map((t, i) => (
                            <tr key={i} className="border-t border-[var(--border)]">
                              <td className="py-1.5 px-3 font-mono">
                                <a href={`${JIRA_BROWSE}/${t.key}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{t.key}</a>
                              </td>
                              <td className="py-1.5 px-3 text-[var(--foreground)] truncate max-w-[200px]">{t.summary}</td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-[var(--foreground)]">{t.weightedTasks}</td>
                              <td className="py-1.5 px-3 text-center">
                                <span className={t.onTime ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                                  {t.onTime ? "Yes" : "No"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* In-Sprint Bugs (DEM board) — grouped by month */}
          {latest.bugs.filter(b => b.source === "DEM").length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                In-Sprint Bugs — DEM ({latest.bugs.filter(b => b.source === "DEM").length})
              </div>
              {(isAggregated ? allMonths : [latest]).map(md => {
                const demBugs = md.bugs.filter(b => b.source === "DEM");
                if (demBugs.length === 0) return null;
                return (
                  <div key={`dem-${md.month}`} className="mb-3">
                    {isAggregated && (
                      <div className="text-[11px] font-semibold text-[var(--warning)] mb-1">{formatMonth(md.month)}</div>
                    )}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-[var(--surface)]">
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                            <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Env</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demBugs.map((b, i) => (
                            <tr key={i} className="border-t border-[var(--border)]">
                              <td className="py-1.5 px-3 font-mono">
                                <a href={`${JIRA_BROWSE}/${b.key}`} target="_blank" rel="noopener noreferrer" className="text-[var(--warning)] hover:underline">{b.key}</a>
                              </td>
                              <td className="py-1.5 px-3 text-[var(--foreground)] truncate max-w-[250px]">{b.summary}</td>
                              <td className="py-1.5 px-3 text-center">
                                <span className={`text-[10px] font-bold ${b.env === "PROD" ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}>{b.env}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Production Bugs (YSHUB board) — grouped by month */}
          {latest.bugs.filter(b => b.source === "YSHUB").length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                Production Bugs — YSHUB ({latest.bugs.filter(b => b.source === "YSHUB").length})
              </div>
              {(isAggregated ? allMonths : [latest]).map(md => {
                const yshubBugs = md.bugs.filter(b => b.source === "YSHUB");
                if (yshubBugs.length === 0) return null;
                return (
                  <div key={`yshub-${md.month}`} className="mb-3">
                    {isAggregated && (
                      <div className="text-[11px] font-semibold text-[var(--danger)] mb-1">{formatMonth(md.month)}</div>
                    )}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="bg-[var(--surface)]">
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                            <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                            <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Provider</th>
                            <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Env</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yshubBugs.map((b, i) => (
                            <tr key={i} className="border-t border-[var(--border)]">
                              <td className="py-1.5 px-3 font-mono">
                                <a href={`${JIRA_BROWSE}/${b.key}`} target="_blank" rel="noopener noreferrer" className="text-[var(--danger)] hover:underline">{b.key}</a>
                              </td>
                              <td className="py-1.5 px-3 text-[var(--foreground)] truncate max-w-[200px]">{b.summary}</td>
                              <td className="py-1.5 px-3 text-center text-[10px] text-[var(--foreground)]">{b.provider}</td>
                              <td className="py-1.5 px-3 text-center">
                                <span className={`text-[10px] font-bold ${
                                  b.env === "PROD" ? "text-[var(--danger)]" :
                                  b.env === "STG" ? "text-[var(--accent)]" :
                                  "text-[var(--warning)]"
                                }`}>{b.env}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* On-Call details */}
          {(latest.ticketsResolved > 0 || isDedicatedOncall) && (
            <div>
              {/* On-call trend for dedicated members */}
              {isDedicatedOncall && allMonths.length > 1 && (
                <div className="mb-3">
                  <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5">On-Call Trend</div>
                  <TrendChart
                    data={allMonths}
                    xKey="month"
                    areas={[{ key: "ticketsResolved", color: "var(--oncall)", name: "Tickets" }]}
                    height={110}
                    partialLast={isPartialMonth}
                  />
                </div>
              )}
              {/* On-call tickets list — grouped by month */}
              {latest.onCallTickets && latest.onCallTickets.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Tickets Handled ({latest.onCallTickets.length})
                  </div>
                  {(isAggregated ? allMonths : [latest]).map(md => {
                    if (!md.onCallTickets || md.onCallTickets.length === 0) return null;
                    return (
                      <div key={`oc-${md.month}`} className="mb-3">
                        {isAggregated && (
                          <div className="text-[11px] font-semibold text-[var(--oncall)] mb-1">{formatMonth(md.month)}</div>
                        )}
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="bg-[var(--surface)]">
                                <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Ticket</th>
                                <th className="py-1.5 px-3 text-left text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Summary</th>
                                <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Priority</th>
                                <th className="py-1.5 px-3 text-center text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">SLA</th>
                                <th className="py-1.5 px-3 text-right text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {md.onCallTickets.map((t, i) => (
                                <tr key={i} className="border-t border-[var(--border)]">
                                  <td className="py-1.5 px-3 font-mono">
                                    <a href={`${JIRA_BROWSE}/${t.key}`} target="_blank" rel="noopener noreferrer" className="text-[var(--oncall)] hover:underline">{t.key}</a>
                                  </td>
                                  <td className="py-1.5 px-3 text-[var(--foreground)] truncate max-w-[200px]">{t.summary}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span className={`text-[10px] font-bold ${
                                      t.priority === "Highest" ? "text-[var(--danger)]" :
                                      t.priority === "High" ? "text-[var(--warning)]" :
                                      "text-[var(--muted)]"
                                    }`}>{t.priority}</span>
                                  </td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span className={`text-[10px] font-bold ${t.slaBreached ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                                      {t.slaBreached ? "Breached" : "Met"}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-3 text-right tabular-nums text-[var(--foreground)]">
                                    {t.resolutionHrs !== null ? `${t.resolutionHrs}h` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
