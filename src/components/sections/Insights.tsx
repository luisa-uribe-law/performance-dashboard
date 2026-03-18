"use client";

import { DeveloperMonthly } from "@/lib/types";
import { computeSpeedAwards, computeOnCallHeroes, computeHelpingHand } from "@/lib/scoring";

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
  const { highestOutput } = computeSpeedAwards(developers);
  const heroes = computeOnCallHeroes(developers);
  const helpingHand = computeHelpingHand(developers);

  // Most on-time tickets: dev with the highest count of on-time integrations
  const integrationDevs = developers.filter(d => d.group !== "dedicated-oncall");
  const devsWithOnTime = integrationDevs
    .map(d => ({
      ...d,
      onTimeTickets: d.integrations.filter(t => t.onTime),
    }))
    .filter(d => d.onTimeTickets.length > 0)
    .sort((a, b) => b.onTimeTickets.length - a.onTimeTickets.length);
  const mostOnTime = devsWithOnTime[0] || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Integration Insights */}
      <div>
        <div className="section-label mb-3">
          <span style={{ color: "var(--accent)" }}>Integration Highlights</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {highestOutput && (
            <InsightCard label="Highest Throughput" name={highestOutput.developer}
              color="var(--accent)" deactivated={highestOutput.deactivated}
              onClick={() => onDevClick(highestOutput.developer)}>
              <span>{highestOutput.weightedTasks} WT from {highestOutput.tasksCompleted} tickets:</span>
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
              color="var(--accent)" deactivated={mostOnTime.deactivated}
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

      {/* On-Call Insights */}
      <div>
        <div className="section-label mb-3">
          <span style={{ color: "var(--oncall)" }}>On-Call Highlights</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {heroes?.ticketMachine && (
            <InsightCard label="Ticket Machine" name={heroes.ticketMachine.developer}
              color="var(--oncall)" deactivated={heroes.ticketMachine.deactivated}
              onClick={() => onDevClick(heroes.ticketMachine!.developer)}>
              {heroes.ticketMachine.ticketsResolved} tickets resolved with {heroes.ticketMachine.slaCompliancePct}% SLA compliance. Highest volume on the on-call team.
            </InsightCard>
          )}
          {heroes?.fastestResolution && (
            <InsightCard label="Fastest Resolution" name={heroes.fastestResolution.developer}
              color="var(--oncall)" deactivated={heroes.fastestResolution.deactivated}
              onClick={() => onDevClick(heroes.fastestResolution!.developer)}>
              Median {(heroes.fastestResolution.medianResolutionHrs / 24).toFixed(1)}d resolution time. Quickest turnaround on support tickets.
            </InsightCard>
          )}
          {heroes?.slaChampion && (
            <InsightCard label="SLA Champion" name={heroes.slaChampion.developer}
              color="var(--oncall)" deactivated={heroes.slaChampion.deactivated}
              onClick={() => onDevClick(heroes.slaChampion!.developer)}>
              {heroes.slaChampion.slaCompliancePct}% SLA compliance on {heroes.slaChampion.ticketsResolved} tickets. Best adherence to resolution targets.
            </InsightCard>
          )}
          {helpingHand && (
            <InsightCard label="Helping Hand" name={helpingHand.developer}
              color="var(--oncall)" deactivated={helpingHand.deactivated}
              onClick={() => onDevClick(helpingHand.developer)}>
              Picked up {helpingHand.ticketsResolved} YSHUB tickets{helpingHand.slaCompliancePct > 0 ? ` with ${helpingHand.slaCompliancePct}% SLA` : ""} while on rotation. Strong cross-functional support.
            </InsightCard>
          )}
        </div>
      </div>
    </div>
  );
}
