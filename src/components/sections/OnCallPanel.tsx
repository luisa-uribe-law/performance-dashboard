"use client";

import { useState } from "react";
import { DeveloperMonthly, MonthlyTeamMetrics, OnCallPriorityMetrics, BugSlaMetrics } from "@/lib/types";
import { formatMonth } from "@/lib/format";
import TrendChart from "../shared/TrendChart";
import SectionCard from "../shared/SectionCard";
import * as XLSX from "xlsx";

interface Props {
  teamData: MonthlyTeamMetrics[];
  priorityData: OnCallPriorityMetrics[];
  bugSla?: BugSlaMetrics;
  developers: DeveloperMonthly[];
  selectedMonth: string;
  onDevClick: (name: string) => void;
  isPartialMonth?: boolean;
}

const JIRA_BROWSE = "https://yunopayments.atlassian.net/browse";

const tabs = [
  { id: "overview", label: "Tickets" },
  { id: "sla", label: "SLA" },
  { id: "resolution", label: "Resolution" },
  { id: "list", label: "Ticket List" },
] as const;

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center min-w-0">
      <div className="text-lg font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}

function DevRow({ name, value, label, max, color, onClick }: { name: string; value: number; label: string; max: number; color: string; onClick: () => void }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <button onClick={onClick} className="flex items-center gap-2 group w-full text-left hover:bg-[var(--surface-hover)] rounded-md px-1.5 py-1 -mx-1.5 transition-colors">
      <span className="text-[11px] text-[var(--foreground)] w-28 truncate group-hover:text-white transition-colors">{name}</span>
      <div className="flex-1 h-4 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
        <div className="h-full rounded-full animate-grow" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold w-16 text-right tabular-nums whitespace-nowrap" style={{ color }}>{value} {label}</span>
    </button>
  );
}

export default function OnCallPanel({ teamData, priorityData, bugSla, selectedMonth, developers, onDevClick, isPartialMonth }: Props) {
  const [tab, setTab] = useState<string>("overview");
  const [slaView, setSlaView] = useState<"all" | "bugs">("all");

  const monthPriority = priorityData.filter(p => p.month === selectedMonth);
  const prevMonthPriority = priorityData.filter(p => p.month !== selectedMonth);
  const latest = teamData[teamData.length - 1];
  const prev = teamData.length >= 2 ? teamData[teamData.length - 2] : null;

  // Developers with on-call tickets, sorted
  const oncallDevs = [...developers].filter(d => d.ticketsResolved > 0).sort((a, b) => b.ticketsResolved - a.ticketsResolved);
  const maxTickets = oncallDevs[0]?.ticketsResolved || 1;
  const oncallDevsSla = [...developers].filter(d => d.slaCompliancePct > 0).sort((a, b) => b.slaCompliancePct - a.slaCompliancePct);
  const oncallDevsRes = [...developers].filter(d => d.medianResolutionHrs > 0).sort((a, b) => a.medianResolutionHrs - b.medianResolutionHrs);

  return (
    <SectionCard title="On-Call Support" subtitle={`YSHUB Board — ${formatMonth(selectedMonth)}`}>
      {/* Tabs */}
      <div className="flex gap-0.5 mb-4 bg-[var(--surface)] rounded-lg p-0.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              tab === t.id
                ? "bg-[var(--oncall)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tickets tab */}
      {tab === "overview" && (
        <div className="space-y-3">
          {latest && (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Resolved" value={`${latest.ticketsResolved}`} color="var(--oncall)" />
              <MiniStat label="SLA Compliance" value={`${latest.slaCompliancePct}%`} color="var(--oncall)" />
              <MiniStat label="vs Last Month" value={prev ? `${latest.ticketsResolved - prev.ticketsResolved >= 0 ? "+" : ""}${latest.ticketsResolved - prev.ticketsResolved} tickets` : "-"} color={prev && latest.ticketsResolved >= prev.ticketsResolved ? "var(--success)" : "var(--danger)"} />
            </div>
          )}
          <TrendChart
            data={teamData}
            xKey="month"
            areas={[
              { key: "ticketsResolved", color: "var(--oncall)", name: "Tickets Resolved" },
            ]}
            height={140}
            partialLast={isPartialMonth}
          />
          {/* Top resolvers */}
          <div>
            <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Top Resolvers</div>
            <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
              {oncallDevs.map(d => (
                <DevRow key={d.developer} name={d.developer} value={d.ticketsResolved} label="tix" max={maxTickets} color="var(--oncall)" onClick={() => onDevClick(d.developer)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SLA tab */}
      {tab === "sla" && (
        <div className="space-y-3">
          {/* Subtab toggle */}
          <div className="flex gap-0.5 bg-[var(--surface)] rounded-md p-0.5">
            <button
              onClick={() => setSlaView("all")}
              className={`flex-1 text-[10px] font-medium py-1 rounded transition-all ${
                slaView === "all" ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >All Tickets</button>
            <button
              onClick={() => setSlaView("bugs")}
              className={`flex-1 text-[10px] font-medium py-1 rounded transition-all ${
                slaView === "bugs" ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >Bugs Only</button>
          </div>

          {slaView === "all" && (
            <>
              {latest && (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Overall SLA" value={`${latest.slaCompliancePct}%`} color="var(--oncall)" />
                  <MiniStat label="Highest Priority" value={monthPriority.find(p => p.priority === "Highest") ? `${monthPriority.find(p => p.priority === "Highest")!.slaCompliancePct}%` : "-"} color="var(--oncall)" />
                  <MiniStat label="vs Last Month" value={prev ? `${(latest.slaCompliancePct - prev.slaCompliancePct) >= 0 ? "+" : ""}${(latest.slaCompliancePct - prev.slaCompliancePct).toFixed(1)}pp` : "-"} color={prev && latest.slaCompliancePct >= prev.slaCompliancePct ? "var(--success)" : "var(--danger)"} />
                </div>
              )}
              <TrendChart
                data={teamData}
                xKey="month"
                areas={[
                  { key: "slaCompliancePct", color: "var(--oncall)", name: "SLA Compliance %" },
                ]}
                yDomain={[0, 100]}
                yFormatter={(v) => `${v}%`}
                height={140}
                partialLast={isPartialMonth}
              />
              <div>
                <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">SLA by Priority</div>
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        <th className="py-2 px-3 text-left text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Priority</th>
                        <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Target</th>
                        <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">SLA %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["Highest", "High", "Medium", "Low"] as const).map(prio => {
                        const targets: Record<string, string> = { Highest: "3 days", High: "2 days", Medium: "3 days", Low: "5 days" };
                        const p = monthPriority.find(mp => mp.priority === prio);
                        return (
                          <tr key={prio} className="border-t border-[var(--border)]">
                            <td className="py-2 px-3 font-medium text-[var(--foreground)]">{prio}</td>
                            <td className="py-2 px-3 text-right text-[var(--muted)]">{targets[prio]}</td>
                            <td className="py-2 px-3 text-right font-bold tabular-nums" style={{ color: "var(--oncall)" }}>{p ? `${p.slaCompliancePct}%` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* SLA by developer */}
              {oncallDevsSla.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">SLA by Developer</div>
                  <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
                    {oncallDevsSla.map(d => (
                      <DevRow key={d.developer} name={d.developer} value={d.slaCompliancePct} label="%" max={100} color="var(--oncall)" onClick={() => onDevClick(d.developer)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {slaView === "bugs" && (
            <>
              <div className="text-[10px] text-[var(--muted)] leading-relaxed rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                Bugs in production regardless of reporter + bugs in other environments only if reported by merchant or company.
              </div>
              {bugSla ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Bugs SLA" value={`${bugSla.overallSlaPct}%`} color="var(--danger)" />
                    <MiniStat label="Total Bugs" value={`${bugSla.totalBugs}`} color="var(--danger)" />
                    <MiniStat label="Median Resolution" value={`${(bugSla.medianResolutionHrs / 24).toFixed(1)}d`} color="var(--danger)" />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Bug SLA by Priority</div>
                    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--surface)]">
                            <th className="py-2 px-3 text-left text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Priority</th>
                            <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Target</th>
                            <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Bugs</th>
                            <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">SLA %</th>
                            <th className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Median</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bugSla.byPriority.map(bp => {
                            const targets: Record<string, string> = { Highest: "3 days", High: "2 days", Medium: "3 days", Low: "5 days" };
                            return (
                              <tr key={bp.priority} className="border-t border-[var(--border)]">
                                <td className="py-2 px-3 font-medium text-[var(--foreground)]">{bp.priority}</td>
                                <td className="py-2 px-3 text-right text-[var(--muted)]">{targets[bp.priority]}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-[var(--foreground)]">{bp.count}</td>
                                <td className="py-2 px-3 text-right font-bold tabular-nums" style={{ color: bp.slaCompliancePct >= 80 ? "var(--success)" : bp.slaCompliancePct >= 50 ? "var(--warning)" : "var(--danger)" }}>{bp.count > 0 ? `${bp.slaCompliancePct}%` : "-"}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-[var(--foreground)]">{bp.count > 0 ? `${(bp.medianResolutionHrs / 24).toFixed(1)}d` : "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-[var(--muted)] text-center py-4">No bug SLA data available. Run a sync to generate this data.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resolution Times tab */}
      {tab === "resolution" && (
        <div className="space-y-3">
          {latest && (
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Median Overall" value={`${latest.medianResolutionDays}d`} color="var(--oncall)" />
              <MiniStat label="vs Last Month" value={prev ? `${(latest.medianResolutionDays - prev.medianResolutionDays) >= 0 ? "+" : ""}${(latest.medianResolutionDays - prev.medianResolutionDays).toFixed(1)}d` : "-"} color={prev && latest.medianResolutionDays <= prev.medianResolutionDays ? "var(--success)" : "var(--danger)"} />
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Median Resolution by Priority</div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface)]">
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Priority</th>
                    {teamData.map(t => (
                      <th key={t.month} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">
                        {t.month.split("-")[1] === "01" ? "Jan" : "Feb"}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(["Highest", "High", "Medium", "Low"] as const).map(prio => {
                    const current = monthPriority.find(p => p.priority === prio);
                    const previous = prevMonthPriority.find(p => p.priority === prio);
                    const improving = current && previous ? current.medianResolutionHrs < previous.medianResolutionHrs : false;
                    return (
                      <tr key={prio} className="border-t border-[var(--border)]">
                        <td className="py-2.5 px-3 font-medium text-[var(--foreground)]">{prio}</td>
                        {teamData.map(t => {
                          const p = priorityData.find(pd => pd.month === t.month && pd.priority === prio);
                          return (
                            <td key={t.month} className="py-2.5 px-3 text-right tabular-nums" style={{ color: "var(--oncall)" }}>
                              {p ? `${p.medianResolutionHrs}h` : "-"}
                              <span className="text-[var(--muted-dim)] text-[10px] ml-1">
                                ({p ? `${(p.medianResolutionHrs / 24).toFixed(1)}d` : "-"})
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center">
                          {current && previous ? (
                            <span className={`text-xs font-bold ${improving ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                              {improving ? "Faster" : "Slower"}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Resolution by developer */}
          {oncallDevsRes.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Resolution Time by Developer (fastest first)</div>
              <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
                {oncallDevsRes.map(d => {
                  const pct = Math.min(100, (d.medianResolutionHrs / (oncallDevsRes[oncallDevsRes.length - 1]?.medianResolutionHrs || 1)) * 100);
                  return (
                    <button key={d.developer} onClick={() => onDevClick(d.developer)} className="flex items-center gap-2 group w-full text-left hover:bg-[var(--surface-hover)] rounded-md px-1.5 py-1 -mx-1.5 transition-colors">
                      <span className="text-[11px] text-[var(--foreground)] w-28 truncate group-hover:text-white transition-colors">{d.developer}</span>
                      <div className="flex-1 h-4 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full rounded-full animate-grow" style={{ width: `${pct}%`, backgroundColor: "var(--oncall)" }} />
                      </div>
                      <span className="text-[11px] font-bold text-right tabular-nums whitespace-nowrap" style={{ color: "var(--oncall)" }}>
                        {d.medianResolutionHrs}h <span className="text-[var(--muted)] font-normal">({(d.medianResolutionHrs / 24).toFixed(1)}d)</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Ticket List tab */}
      {tab === "list" && (() => {
        const allTickets = developers.flatMap(d =>
          d.onCallTickets.map(t => ({ ...t, developer: d.developer }))
        ).sort((a, b) => (b.closedDate || "").localeCompare(a.closedDate || ""));

        function downloadExcel() {
          const rows = allTickets.map(t => ({
            "Ticket ID": t.key,
            "Link to Jira": `${JIRA_BROWSE}/${t.key}`,
            "Summary": t.summary,
            "Assignee": t.developer,
            "Date Completed": t.closedDate || "",
            "Priority": t.priority,
            "SLA": t.slaBreached ? "Breached" : "Met",
            "Resolution (hrs)": t.resolutionHrs ?? "",
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "On-Call Tickets");
          XLSX.writeFile(wb, `oncall-tickets-${selectedMonth}.xlsx`);
        }

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">{allTickets.length} tickets resolved</div>
              <button onClick={downloadExcel} className="text-[10px] font-medium text-[var(--oncall)] hover:underline flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export Excel
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto pr-1 space-y-0">
              {allTickets.map(t => (
                <div key={t.key} className="flex items-start gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                  <a
                    href={`${JIRA_BROWSE}/${t.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono font-medium text-[var(--oncall)] hover:underline shrink-0 w-24"
                  >
                    {t.key}
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[var(--foreground)] truncate">{t.summary}</div>
                    <div className="text-[10px] text-[var(--muted)]">
                      {t.developer} · {t.priority}
                      {t.resolutionHrs != null ? ` · ${t.resolutionHrs}h` : ""}
                      {t.slaBreached ? " · SLA breached" : ""}
                      {t.closedDate ? ` · ${t.closedDate}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {allTickets.length === 0 && (
                <div className="text-[11px] text-[var(--muted)] text-center py-4">No tickets this month</div>
              )}
            </div>
          </div>
        );
      })()}

    </SectionCard>
  );
}
