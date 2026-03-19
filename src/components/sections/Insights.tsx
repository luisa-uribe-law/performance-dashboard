"use client";

import { DeveloperMonthly, MonthlyTeamMetrics } from "@/lib/types";
import KpiCard from "@/components/shared/KpiCard";

interface Props {
  open: boolean;
  onClose: () => void;
  developers: DeveloperMonthly[];
  currentTeam: MonthlyTeamMetrics;
  prevTeam?: MonthlyTeamMetrics;
  onDevClick: (name: string) => void;
  dateLabel: string;
  partialLabel?: string | null;
}

function InsightCard({ label, name, children, color, onClick, deactivated }: {
  label: string; name: string; children: React.ReactNode; color: string; onClick: () => void; deactivated?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--border-light)] hover:bg-[var(--card-hover)] transition-all group text-left w-full h-full"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      {/* Label — fixed */}
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color }}>{label}</div>
      {/* Name — fixed */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[15px] font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">{name}</span>
        {deactivated && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--muted)]/15 text-[var(--muted)] shrink-0">
            Deactivated
          </span>
        )}
      </div>
      {/* Content — fills remaining space */}
      <div className="text-[11px] text-[var(--muted)] leading-snug opacity-90 flex-1">{children}</div>
    </button>
  );
}

export default function Insights({ open, onClose, developers, currentTeam, prevTeam, onDevClick, dateLabel, partialLabel }: Props) {
  if (!open) return null;

  const integrationDevs = developers.filter(d => d.group !== "dedicated-oncall");
  const withTasks = integrationDevs.filter(d => d.tasksCompleted > 0);

  // Highest Output: most tasks closed
  const highestOutput = [...withTasks].sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0] || null;

  // Most On-Time: most on-time tickets, must be a different person
  const devsWithOnTime = withTasks
    .map(d => ({ ...d, onTimeTickets: d.integrations.filter(t => t.onTime) }))
    .filter(d => d.onTimeTickets.length > 0 && d.developer !== highestOutput?.developer)
    .sort((a, b) => b.onTimeTickets.length - a.onTimeTickets.length);
  const mostOnTime = devsWithOnTime[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[80px] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Integration Highlights</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">{dateLabel}</p>
            {partialLabel && (
              <p className="text-[10px] text-[var(--warning)] font-medium mt-0.5">{partialLabel}</p>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* KPI Cards */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Team Metrics</div>
            <div className="grid grid-cols-3 gap-2 items-stretch">
              <KpiCard label="Completed Tasks" subtitle="Integrations & features delivered" value={currentTeam.tasksCompleted} prevValue={prevTeam?.tasksCompleted} color="var(--accent)" deltaLabel=" tasks" />
              <KpiCard label="On-Time Delivery" subtitle="% delivered by deadline" value={currentTeam.onTimeDeliveryPct} suffix="%" prevValue={prevTeam?.onTimeDeliveryPct} color="var(--accent)" deltaLabel="pp" />
              <KpiCard label="PROD Bugs" subtitle="Bugs found in production" value={currentTeam.prodBugs} prevValue={prevTeam?.prodBugs} color={currentTeam.prodBugs <= 3 ? "var(--accent)" : "var(--danger)"} invertDelta deltaLabel=" bugs" />
            </div>
          </div>

          {/* Highlight Cards */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Standouts</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-stretch">
              {highestOutput && (
                <InsightCard label="Highest Output" name={highestOutput.developer}
                  color="var(--accent)" deactivated={highestOutput.deactivated}
                  onClick={() => { onDevClick(highestOutput.developer); onClose(); }}>
                  <span>{highestOutput.tasksCompleted} tasks closed:</span>
                  <ul className="mt-1 space-y-0.5 list-none">
                    {highestOutput.integrations.slice(0, 4).map(t => (
                      <li key={t.key} className="flex items-start gap-1">
                        <span className="shrink-0 text-[9px] mt-[2px]" style={{ color: "var(--accent)" }}>&#9679;</span>
                        <span className="truncate">{t.summary}</span>
                      </li>
                    ))}
                    {highestOutput.integrations.length > 4 && (
                      <li className="text-[10px]" style={{ color: "var(--accent)" }}>+{highestOutput.integrations.length - 4} more</li>
                    )}
                  </ul>
                </InsightCard>
              )}
              {mostOnTime && (
                <InsightCard label="Most On-Time Deliveries" name={mostOnTime.developer}
                  color="var(--success)" deactivated={mostOnTime.deactivated}
                  onClick={() => { onDevClick(mostOnTime.developer); onClose(); }}>
                  <span>{mostOnTime.onTimeTickets.length} of {mostOnTime.integrations.length} tickets closed on time:</span>
                  <ul className="mt-1 space-y-0.5 list-none">
                    {mostOnTime.onTimeTickets.slice(0, 4).map(t => (
                      <li key={t.key} className="flex items-start gap-1">
                        <span className="shrink-0 text-[9px] mt-[2px]" style={{ color: "var(--success)" }}>&#9679;</span>
                        <span className="truncate">{t.summary}</span>
                      </li>
                    ))}
                    {mostOnTime.onTimeTickets.length > 4 && (
                      <li className="text-[10px]" style={{ color: "var(--success)" }}>+{mostOnTime.onTimeTickets.length - 4} more</li>
                    )}
                  </ul>
                </InsightCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
