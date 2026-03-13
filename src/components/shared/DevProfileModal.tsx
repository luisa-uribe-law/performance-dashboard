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

function StatWithDelta({ label, value, prev, suffix, color, invertDelta }: {
  label: string; value: number; prev?: number; suffix?: string; color: string; invertDelta?: boolean;
}) {
  const delta = prev !== undefined ? value - prev : null;
  const positive = invertDelta ? (delta !== null && delta <= 0) : (delta !== null && delta >= 0);
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color }}>{value}{suffix || ""}</span>
        {delta !== null && (
          <span className={`text-[10px] font-semibold ${positive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {delta >= 0 ? "+" : ""}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DevProfileModal({ developer, allMonths, aggregated, onClose }: Props) {
  const latest = aggregated || allMonths[allMonths.length - 1];
  if (!latest) return null;

  const isAggregated = !!aggregated;
  const prev = !isAggregated && allMonths.length >= 2 ? allMonths[allMonths.length - 2] : undefined;

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
          {/* Stats with vs-previous on the right */}
          <div>
            <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
              Performance — {isAggregated ? "Selected Range" : formatMonth(latest.month)}{prev ? ` vs ${formatMonth(prev.month)}` : ""}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-1">
              <StatWithDelta label="Tasks Completed" value={latest.tasksCompleted} prev={prev?.tasksCompleted} color="var(--accent)" />
              <StatWithDelta label="Weighted Throughput" value={latest.weightedTasks} prev={prev?.weightedTasks} color="var(--accent)" />
              <StatWithDelta label="On-Time Delivery" value={latest.onTimeDeliveryPct} prev={prev?.onTimeDeliveryPct} suffix="%" color="var(--success)" />
              <StatWithDelta label="PROD Bugs" value={latest.prodBugs} prev={prev?.prodBugs} color={latest.prodBugs === 0 ? "var(--success)" : "var(--danger)"} invertDelta />
              <StatWithDelta label="SBX Bugs" value={latest.sbxBugs} prev={prev?.sbxBugs} color="var(--muted)" invertDelta />
            </div>
          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Output Trend</div>
              <TrendChart
                data={allMonths}
                xKey="month"
                areas={[{ key: "weightedTasks", color: "var(--accent)", name: "Weighted Tasks" }]}
                height={130}
                partialLast={isPartialMonth}
              />
            </div>
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Quality</div>
              <TrendChart
                data={allMonths}
                xKey="month"
                lines={[
                  { key: "onTimeDeliveryPct", color: "var(--success)", name: "OTD %" },
                ]}
                yDomain={[0, 100]}
                yFormatter={(v) => `${v}%`}
                height={130}
                partialLast={isPartialMonth}
              />
            </div>
          </div>

          {/* Integrations list */}
          {latest.integrations.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                Integrations Worked On ({latest.integrations.length})
              </div>
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
                    {latest.integrations.map((t, i) => (
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
          )}

          {/* In-Sprint Bugs (DEM board) */}
          {latest.bugs.filter(b => b.source === "DEM").length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                In-Sprint Bugs — DEM ({latest.bugs.filter(b => b.source === "DEM").length})
              </div>
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
                    {latest.bugs.filter(b => b.source === "DEM").map((b, i) => (
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
          )}

          {/* Production Bugs (YSHUB board) */}
          {latest.bugs.filter(b => b.source === "YSHUB").length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                Production Bugs — YSHUB ({latest.bugs.filter(b => b.source === "YSHUB").length})
              </div>
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
                    {latest.bugs.filter(b => b.source === "YSHUB").map((b, i) => (
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
          )}

          {/* On-Call section */}
          {(latest.ticketsResolved > 0 || isDedicatedOncall) && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">On-Call Results</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--oncall)" }}>{latest.ticketsResolved}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Tickets</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--success)" }}>{latest.slaCompliancePct}%</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">SLA</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--oncall)" }}>{latest.medianResolutionHrs}h</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">Median Time</div>
                </div>
              </div>
              {/* On-call trend for dedicated members */}
              {isDedicatedOncall && allMonths.length > 1 && (
                <div className="mt-3">
                  <TrendChart
                    data={allMonths}
                    xKey="month"
                    areas={[{ key: "ticketsResolved", color: "var(--oncall)", name: "Tickets" }]}
                    height={110}
                    partialLast={isPartialMonth}
                  />
                </div>
              )}
              {/* On-call tickets list */}
              {latest.onCallTickets && latest.onCallTickets.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-2">
                    Tickets Handled ({latest.onCallTickets.length})
                  </div>
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
                        {latest.onCallTickets.map((t, i) => (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
