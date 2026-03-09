"use client";

import { DeveloperMonthly } from "@/lib/types";
import { computeSpeedAwards, computeOnCallHeroes, computeHelpingHand, getAiAdoptionCategories, getBugFreeDevs } from "@/lib/scoring";

interface Props {
  developers: DeveloperMonthly[];
  onDevClick: (name: string) => void;
}

function InsightCard({ label, name, description, color, onClick, deactivated }: {
  label: string; name: string; description: string; color: string; onClick: () => void; deactivated?: boolean;
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
      <div className="text-[11px] text-[var(--muted)] leading-snug opacity-90">{description}</div>
    </button>
  );
}

export default function Insights({ developers, onDevClick }: Props) {
  const { highestOutput, mostTimely } = computeSpeedAwards(developers);
  const heroes = computeOnCallHeroes(developers);
  const helpingHand = computeHelpingHand(developers);
  const { topAdopter } = getAiAdoptionCategories(developers);
  const bugFree = getBugFreeDevs(developers);

  const integrationDevs = developers.filter(d => d.group !== "dedicated-oncall");
  const devsWithBugs = [...integrationDevs].filter(d => (d.prodBugs + d.sbxBugs) > 0).sort((a, b) => (b.prodBugs + b.sbxBugs) - (a.prodBugs + a.sbxBugs));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Integration Insights */}
      <div>
        <div className="section-label mb-3">
          <span style={{ color: "var(--accent)" }}>Integration Highlights</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topAdopter && (
            <InsightCard label="Top AI Adopter" name={topAdopter.developer}
              description={`${topAdopter.aiCodeRatio}% AI code ratio — highest on the team. Leading AI-assisted development adoption.`}
              color="var(--accent)" deactivated={topAdopter.deactivated}
              onClick={() => onDevClick(topAdopter.developer)} />
          )}
          {highestOutput && (
            <InsightCard label="Highest Throughput" name={highestOutput.developer}
              description={`${highestOutput.weightedTasks} weighted tasks from ${highestOutput.tasksCompleted} DEM tickets. Most productive integration output.`}
              color="var(--accent)" deactivated={highestOutput.deactivated}
              onClick={() => onDevClick(highestOutput.developer)} />
          )}
          {mostTimely && mostTimely.onTimeDeliveryPct > 0 && (
            <InsightCard label="Most Timely Delivery" name={mostTimely.developer}
              description={`${mostTimely.onTimeDeliveryPct}% on-time delivery with ${mostTimely.tasksCompleted} tasks completed. Consistently meets deadlines.`}
              color="var(--accent)" deactivated={mostTimely.deactivated}
              onClick={() => onDevClick(mostTimely.developer)} />
          )}
          {bugFree.length > 0 ? (
            <InsightCard label="Zero-Bug Delivery" name={`${bugFree.length} developers`}
              description={`${bugFree.slice(0, 3).join(", ")}${bugFree.length > 3 ? ` and ${bugFree.length - 3} more` : ""} shipped with 0 bugs.`}
              color="var(--accent)"
              onClick={() => bugFree[0] && onDevClick(bugFree[0])} />
          ) : devsWithBugs.length > 0 && (
            <InsightCard label="Most Bugs" name={devsWithBugs[0].developer}
              description={`${devsWithBugs[0].prodBugs} PROD + ${devsWithBugs[0].sbxBugs} SBX bugs. Needs attention on code quality.`}
              color="var(--danger)" deactivated={devsWithBugs[0].deactivated}
              onClick={() => onDevClick(devsWithBugs[0].developer)} />
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
              description={`${heroes.ticketMachine.ticketsResolved} tickets resolved with ${heroes.ticketMachine.slaCompliancePct}% SLA compliance. Highest volume on the on-call team.`}
              color="var(--oncall)" deactivated={heroes.ticketMachine.deactivated}
              onClick={() => onDevClick(heroes.ticketMachine!.developer)} />
          )}
          {heroes?.fastestResolution && (
            <InsightCard label="Fastest Resolution" name={heroes.fastestResolution.developer}
              description={`Median ${(heroes.fastestResolution.medianResolutionHrs / 24).toFixed(1)}d resolution time. Quickest turnaround on support tickets.`}
              color="var(--oncall)" deactivated={heroes.fastestResolution.deactivated}
              onClick={() => onDevClick(heroes.fastestResolution!.developer)} />
          )}
          {heroes?.slaChampion && (
            <InsightCard label="SLA Champion" name={heroes.slaChampion.developer}
              description={`${heroes.slaChampion.slaCompliancePct}% SLA compliance on ${heroes.slaChampion.ticketsResolved} tickets. Best adherence to resolution targets.`}
              color="var(--oncall)" deactivated={heroes.slaChampion.deactivated}
              onClick={() => onDevClick(heroes.slaChampion!.developer)} />
          )}
          {helpingHand && (
            <InsightCard label="Helping Hand" name={helpingHand.developer}
              description={`Picked up ${helpingHand.ticketsResolved} YSHUB tickets${helpingHand.slaCompliancePct > 0 ? ` with ${helpingHand.slaCompliancePct}% SLA` : ""} while on rotation. Strong cross-functional support.`}
              color="var(--oncall)" deactivated={helpingHand.deactivated}
              onClick={() => onDevClick(helpingHand.developer)} />
          )}
        </div>
      </div>
    </div>
  );
}
