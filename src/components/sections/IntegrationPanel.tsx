"use client";

import { useState } from "react";
import { DeveloperMonthly, MonthlyTeamMetrics } from "@/lib/types";
import { formatMonth } from "@/lib/format";
import TrendChart from "../shared/TrendChart";
import SectionCard from "../shared/SectionCard";
import * as XLSX from "xlsx";

interface Props {
  teamData: MonthlyTeamMetrics[];
  developers: DeveloperMonthly[];
  selectedMonth: string;
  onDevClick: (name: string) => void;
  isPartialMonth?: boolean;
}

const JIRA_BROWSE = "https://yunopayments.atlassian.net/browse";

const tabs = [
  { id: "tasks", label: "Tasks" },
  { id: "otd", label: "On-Time" },
  { id: "bugs", label: "Bugs" },
  { id: "list", label: "Task List" },
] as const;

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center min-w-0">
      <div className="text-lg font-bold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--muted)] mt-0.5">{label}</div>
    </div>
  );
}

function BarRow({ name, value, label, max, color, onClick }: { name: string; value: number; label: string; max: number; color: string; onClick: () => void }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <button onClick={onClick} className="flex items-center gap-2 group w-full text-left hover:bg-[var(--surface-hover)] rounded-md px-1.5 py-1 -mx-1.5 transition-colors">
      <span className="text-[11px] text-[var(--foreground)] w-28 truncate group-hover:text-white transition-colors">{name}</span>
      <div className="flex-1 h-4 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
        <div className="h-full rounded-full animate-grow" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold w-14 text-right tabular-nums whitespace-nowrap" style={{ color }}>{value}{label}</span>
    </button>
  );
}

export default function IntegrationPanel({ teamData, developers, selectedMonth, onDevClick, isPartialMonth }: Props) {
  const [tab, setTab] = useState<string>("tasks");

  const latest = teamData[teamData.length - 1];
  const prev = teamData.length >= 2 ? teamData[teamData.length - 2] : null;

  // Tasks data — sorted by DEM tasks, show WT as secondary metric
  const sortedByTasks = [...developers].filter(d => d.tasksCompleted > 0 || d.weightedTasks > 0).sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  const maxTasks = sortedByTasks[0]?.tasksCompleted || 1;

  // OTD data — devs with tasks, sorted by OTD desc
  const sortedByOtd = [...developers].filter(d => d.tasksCompleted > 0).sort((a, b) => b.onTimeDeliveryPct - a.onTimeDeliveryPct);

  // Bugs data — sorted by total bugs desc
  const sortedByBugs = [...developers].filter(d => (d.prodBugs + d.sbxBugs) > 0).sort((a, b) => (b.prodBugs + b.sbxBugs) - (a.prodBugs + a.sbxBugs));
  const maxBugs = sortedByBugs[0] ? (sortedByBugs[0].prodBugs + sortedByBugs[0].sbxBugs) : 1;

  return (
    <SectionCard title="Integration Requests" subtitle={`DEM Board — ${formatMonth(selectedMonth)}`}>
      {/* Tabs */}
      <div className="flex gap-0.5 mb-4 bg-[var(--surface)] rounded-lg p-0.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              tab === t.id
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {latest && (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Completed" value={`${latest.tasksCompleted}`} color="var(--accent)" />
              <MiniStat label="Per Dev" value={`${latest.tasksPerDeveloper}`} color="var(--accent)" />
              <MiniStat label="vs Last Month" value={prev ? `${latest.tasksCompleted - prev.tasksCompleted >= 0 ? "+" : ""}${latest.tasksCompleted - prev.tasksCompleted} tasks` : "-"} color={prev && latest.tasksCompleted >= prev.tasksCompleted ? "var(--success)" : "var(--danger)"} />
            </div>
          )}
          <TrendChart
            data={teamData}
            xKey="month"
            areas={[
              { key: "tasksCompleted", color: "var(--accent)", name: "Tasks Completed" },
            ]}
            height={140}
            partialLast={isPartialMonth}
          />
          {/* Top performers by tasks */}
          <div>
            <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Tasks by Developer</div>
            <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
              {sortedByTasks.map(d => (
                <button key={d.developer} onClick={() => onDevClick(d.developer)} className="flex items-center gap-2 group w-full text-left hover:bg-[var(--surface-hover)] rounded-md px-1.5 py-1 -mx-1.5 transition-colors">
                  <span className="text-[11px] text-[var(--foreground)] w-28 truncate group-hover:text-white transition-colors">{d.developer}</span>
                  <div className="flex-1 h-4 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
                    <div className="h-full rounded-full animate-grow" style={{ width: `${Math.min(100, (d.tasksCompleted / maxTasks) * 100)}%`, backgroundColor: "var(--accent)" }} />
                  </div>
                  <span className="text-[11px] font-bold w-8 text-right tabular-nums" style={{ color: "var(--accent)" }}>{d.tasksCompleted}</span>
                  <span className="text-[10px] text-[var(--muted)] w-10 text-right tabular-nums">WT {d.weightedTasks}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OTD tab */}
      {tab === "otd" && (
        <div className="space-y-3">
          {latest && (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="OTD Rate" value={`${latest.onTimeDeliveryPct}%`} color="var(--accent)" />
              <MiniStat label="Tasks/Dev" value={`${latest.tasksPerDeveloper}`} color="var(--accent)" />
              <MiniStat label="vs Last Month" value={prev ? `${latest.onTimeDeliveryPct - prev.onTimeDeliveryPct >= 0 ? "+" : ""}${latest.onTimeDeliveryPct - prev.onTimeDeliveryPct}pp` : "-"} color={prev && latest.onTimeDeliveryPct >= prev.onTimeDeliveryPct ? "var(--success)" : "var(--danger)"} />
            </div>
          )}
          <TrendChart
            data={teamData}
            xKey="month"
            areas={[
              { key: "onTimeDeliveryPct", color: "var(--accent)", name: "On-Time Delivery %" },
            ]}
            yDomain={[0, 100]}
            yFormatter={(v) => `${v}%`}
            height={140}
            partialLast={isPartialMonth}
          />
          {/* OTD by developer */}
          {sortedByOtd.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">On-Time Delivery by Developer</div>
              <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
                {sortedByOtd.map(d => (
                  <BarRow key={d.developer} name={d.developer} value={d.onTimeDeliveryPct} label="%" max={100} color="var(--accent)" onClick={() => onDevClick(d.developer)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bugs tab */}
      {tab === "bugs" && (
        <div className="space-y-3">
          {latest && (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="PROD Bugs" value={`${latest.prodBugs}`} color={latest.prodBugs <= 3 ? "var(--accent)" : "var(--danger)"} />
              <MiniStat label="SBX Bugs" value={`${latest.sbxBugs}`} color="var(--accent)" />
              <MiniStat label="vs Last Month" value={prev ? `${latest.prodBugs - prev.prodBugs >= 0 ? "+" : ""}${latest.prodBugs - prev.prodBugs} PROD` : "-"} color={prev && latest.prodBugs <= prev.prodBugs ? "var(--success)" : "var(--danger)"} />
            </div>
          )}
          <TrendChart
            data={teamData}
            xKey="month"
            bars={[
              { key: "prodBugs", color: "var(--danger)", name: "PROD" },
              { key: "sbxBugs", color: "var(--warning)", name: "SBX" },
            ]}
            height={140}
            partialLast={isPartialMonth}
          />
          {/* Devs with most bugs */}
          {sortedByBugs.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wider">Bugs by Developer</div>
              <div className="space-y-0 max-h-[200px] overflow-y-auto pr-1">
                {sortedByBugs.map(d => (
                  <BarRow key={d.developer} name={d.developer} value={d.prodBugs + d.sbxBugs} label=" bugs" max={maxBugs} color="var(--danger)" onClick={() => onDevClick(d.developer)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task List tab */}
      {tab === "list" && (() => {
        const allTasks = developers.flatMap(d =>
          d.integrations.map(t => ({ ...t, developer: d.developer }))
        ).sort((a, b) => (b.closedDate || "").localeCompare(a.closedDate || ""));

        function downloadExcel() {
          const rows = allTasks.map(t => ({
            "Ticket ID": t.key,
            "Link to Jira": `${JIRA_BROWSE}/${t.key}`,
            "Summary": t.summary,
            "Assignee": t.developer,
            "Date Completed": t.closedDate || "",
            "Weighted Tasks": t.weightedTasks,
            "On-Time": t.onTime ? "Yes" : "No",
          }));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Integration Tasks");
          XLSX.writeFile(wb, `integration-tasks-${selectedMonth}.xlsx`);
        }

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">{allTasks.length} tasks completed</div>
              <button onClick={downloadExcel} className="text-[10px] font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export Excel
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto pr-1 space-y-0">
              {allTasks.map(t => (
                <div key={t.key} className="flex items-start gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                  <a
                    href={`${JIRA_BROWSE}/${t.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono font-medium text-[var(--accent)] hover:underline shrink-0 w-20"
                  >
                    {t.key}
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[var(--foreground)] truncate">{t.summary}</div>
                    <div className="text-[10px] text-[var(--muted)]">{t.developer} · WT {t.weightedTasks}{t.onTime ? " · On-time" : ""}{t.closedDate ? ` · ${t.closedDate}` : ""}</div>
                  </div>
                </div>
              ))}
              {allTasks.length === 0 && (
                <div className="text-[11px] text-[var(--muted)] text-center py-4">No tasks this month</div>
              )}
            </div>
          </div>
        );
      })()}

    </SectionCard>
  );
}
