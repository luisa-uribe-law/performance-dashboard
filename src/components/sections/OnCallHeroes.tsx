"use client";

import { DeveloperMonthly } from "@/lib/types";
import { computeOnCallHeroes, computeHelpingHand } from "@/lib/scoring";
import AwardCard from "../shared/AwardCard";
import SectionCard from "../shared/SectionCard";

interface Props {
  developers: DeveloperMonthly[];
  onDevClick: (name: string) => void;
}

export default function OnCallHeroes({ developers, onDevClick }: Props) {
  const heroes = computeOnCallHeroes(developers);
  const helpingHand = computeHelpingHand(developers);

  if (!heroes) {
    return (
      <SectionCard title="On-Call Heroes" subtitle="Support leaderboard">
        <div className="flex items-center justify-center h-32 text-[var(--muted-dim)] text-sm">
          No on-call data for this period
        </div>
      </SectionCard>
    );
  }

  const { ticketMachine, fastestResolution, slaChampion } = heroes;

  return (
    <SectionCard title="On-Call Heroes" subtitle="Support leaderboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ticketMachine && (
          <AwardCard
            icon="🎫" title="Ticket Machine" subtitle="Most tickets resolved"
            developer={ticketMachine.developer}
            value={`${ticketMachine.ticketsResolved} tickets`}
            color="#A78BFA"
            onClick={() => onDevClick(ticketMachine.developer)}
          />
        )}
        {fastestResolution && (
          <AwardCard
            icon="⚡" title="Fastest Resolution" subtitle="Lowest median time"
            developer={fastestResolution.developer}
            value={`${(fastestResolution.medianResolutionHrs / 24).toFixed(1)}d median`}
            color="var(--yuno-blue)"
            onClick={() => onDevClick(fastestResolution.developer)}
          />
        )}
        {slaChampion && (
          <AwardCard
            icon="🏆" title="SLA Champion" subtitle="Highest SLA compliance"
            developer={slaChampion.developer}
            value={`${slaChampion.slaCompliancePct}% SLA`}
            color="var(--yuno-green-dark)"
            onClick={() => onDevClick(slaChampion.developer)}
          />
        )}
        {helpingHand && (
          <AwardCard
            icon="🤝" title="Helping Hand" subtitle="Rotating dev with most support tickets"
            developer={helpingHand.developer}
            value={`${helpingHand.ticketsResolved} tickets${helpingHand.slaCompliancePct > 0 ? ` · ${helpingHand.slaCompliancePct}% SLA` : ""}`}
            color="var(--warning)"
            onClick={() => onDevClick(helpingHand.developer)}
          />
        )}
      </div>
    </SectionCard>
  );
}
