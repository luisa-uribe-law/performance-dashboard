"use client";

import { useMemo } from "react";
import { DeveloperMonthly, Squad } from "@/lib/types";
import SectionCard from "../shared/SectionCard";

interface Props {
  developers: DeveloperMonthly[];
  onDevClick: (name: string) => void;
}

const squadOrder: Squad[] = ["the-hallows", "mortifagos", "dementors", "dedicated-oncall"];

const squadConfig: Record<Squad, { label: string; color: string }> = {
  "the-hallows": { label: "The Hallows", color: "#8b5cf6" },
  "mortifagos": { label: "Mortifagos", color: "#10b981" },
  "dementors": { label: "Dementors", color: "#f59e0b" },
  "dedicated-oncall": { label: "Dedicated On-Call", color: "#06b6d4" },
};

function sortDevs(devs: DeveloperMonthly[]): DeveloperMonthly[] {
  return [...devs].sort((a, b) => {
    // Tech Lead first
    const aLead = a.role === "Tech Lead" ? 0 : 1;
    const bLead = b.role === "Tech Lead" ? 0 : 1;
    if (aLead !== bLead) return aLead - bLead;
    // Then alphabetical
    return a.developer.localeCompare(b.developer);
  });
}

export default function TeamRoster({ developers, onDevClick }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<Squad, DeveloperMonthly[]>();
    for (const squad of squadOrder) map.set(squad, []);
    for (const d of developers) {
      const list = map.get(d.group);
      if (list) list.push(d);
      else {
        if (!map.has(d.group)) map.set(d.group, []);
        map.get(d.group)!.push(d);
      }
    }
    const result: { squad: Squad; devs: DeveloperMonthly[] }[] = [];
    for (const [squad, devs] of map) {
      if (devs.length > 0) result.push({ squad, devs: sortDevs(devs) });
    }
    return result;
  }, [developers]);

  return (
    <SectionCard title="Developer Metrics" subtitle="All team members — grouped by squad">
      <div className="space-y-4">
        {grouped.map(({ squad, devs }) => {
          const cfg = squadConfig[squad] || { label: squad, color: "var(--muted)" };
          return (
            <div key={squad}>
              {/* Squad header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="text-[10px] text-[var(--muted)]">({devs.length})</span>
                <div className="flex-1 h-px" style={{ backgroundColor: `color-mix(in srgb, ${cfg.color} 20%, transparent)` }} />
              </div>

              <div className="overflow-x-auto rounded-lg border border-[var(--border)]" style={{ borderColor: `color-mix(in srgb, ${cfg.color} 25%, var(--border))` }}>
                <table className="w-full text-[13px] table-fixed">
                  <colgroup>
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "16%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: `color-mix(in srgb, ${cfg.color} 8%, var(--surface))` }}>
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Developer</th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="DEM board tasks completed (epics, stories, tech debt)">
                        <div>DEM Tasks</div>
                      </th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="YSHUB support tickets resolved">
                        <div>On-Call Tickets</div>
                      </th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="Weighted tasks — tasks normalized by complexity (1-7 scale)">
                        <div>Weighted</div>
                      </th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="On-Time Delivery % (integration devs) / SLA Compliance % (on-call devs)">
                        <div>OTD / SLA</div>
                      </th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="Total bugs (PROD + SBX)">
                        <div>Bugs</div>
                      </th>
                      <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]" title="Median ticket resolution time in days">
                        <div>Median Resolution</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {devs.map((d, i) => {
                      const isDedicatedOncall = d.group === "dedicated-oncall";
                      const isLead = d.role === "Tech Lead";
                      return (
                        <tr
                          key={d.developer}
                          onClick={() => onDevClick(d.developer)}
                          className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors animate-fade-in"
                          style={{ animationDelay: `${i * 15}ms`, opacity: 0 }}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${d.deactivated ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}>{d.developer}</span>
                              {isLead && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: `color-mix(in srgb, ${cfg.color} 15%, transparent)` }}>
                                  TL
                                </span>
                              )}
                              {d.deactivated && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--muted)]/15 text-[var(--muted)]">
                                  Deactivated
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[var(--foreground)]">{d.tasksCompleted || <span className="text-[var(--muted-dim)]">-</span>}</td>
                          <td className="py-2 px-3 text-right tabular-nums" style={{ color: d.ticketsResolved > 0 ? "var(--oncall)" : "var(--muted-dim)" }}>{d.ticketsResolved || "-"}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold" style={{ color: cfg.color }}>{d.weightedTasks}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {isDedicatedOncall ? (
                              <span style={{ color: cfg.color }}>
                                {d.slaCompliancePct}%
                              </span>
                            ) : d.tasksCompleted > 0 ? (
                              <span style={{ color: cfg.color }}>
                                {d.onTimeDeliveryPct}%
                              </span>
                            ) : (
                              <span className="text-[var(--muted-dim)]">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {(() => { const total = d.prodBugs + d.sbxBugs; return (
                              <span style={{ color: total === 0 ? "var(--muted-dim)" : "var(--danger)" }}>{total}</span>
                            ); })()}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums" style={{ color: d.medianResolutionHrs > 0 ? "var(--oncall)" : "var(--muted-dim)" }}>
                            {d.medianResolutionHrs > 0 ? `${(d.medianResolutionHrs / 24).toFixed(1)}d (${Math.round(d.medianResolutionHrs)}h)` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
