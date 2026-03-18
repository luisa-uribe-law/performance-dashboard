"use client";

import { DeveloperMonthly } from "@/lib/types";

interface Props {
  developers: DeveloperMonthly[];
  onDevClick: (name: string) => void;
}

function InsightCard({ label, name, children, color, onClick, deactivated }: {
  label: string; name: string; children: React.ReactNode; color: string; onClick: () => void; deactivated?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 hover:border-[var(--border-light)] hover:bg-[var(--card-hover)] transition-all group text-left w-full"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-[var(--foreground)] group-hover:text-white transition-colors truncate">{name}</span>
        {deactivated && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--muted)]/15 text-[var(--muted)] shrink-0">
            Deactivated
          </span>
        )}
      </div>
      <div className="text-[11px] text-[var(--muted)] leading-snug opacity-90">{children}</div>
    </button>
  );
}

export default function Insights({ developers, onDevClick }: Props) {
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
    <div>
      <div className="section-label mb-3">
        <span style={{ color: "var(--accent)" }}>Highlights</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {highestOutput && (
          <InsightCard label="Highest Output" name={highestOutput.developer}
            color="var(--accent)" deactivated={highestOutput.deactivated}
            onClick={() => onDevClick(highestOutput.developer)}>
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
            onClick={() => onDevClick(mostOnTime.developer)}>
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
  );
}
