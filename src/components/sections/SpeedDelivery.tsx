"use client";

import { DeveloperMonthly } from "@/lib/types";
import { computeSpeedAwards } from "@/lib/scoring";
import AwardCard from "../shared/AwardCard";
import SectionCard from "../shared/SectionCard";

interface Props {
  developers: DeveloperMonthly[];
  onDevClick: (name: string) => void;
}

export default function SpeedDelivery({ developers, onDevClick }: Props) {
  const { highestOutput, mostTimely, toughestOtd, roomToGrow } = computeSpeedAwards(developers);

  return (
    <SectionCard title="Speed & Delivery" subtitle="Monthly highlights">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {highestOutput && (
          <AwardCard
            icon="⚡" title="Highest Output" subtitle="Most weighted tasks"
            developer={highestOutput.developer}
            value={`${highestOutput.tasksCompleted} tasks, WT ${highestOutput.weightedTasks}`}
            color="var(--yuno-blue)"
            onClick={() => onDevClick(highestOutput.developer)}
          />
        )}
        {mostTimely && (
          <AwardCard
            icon="🎯" title="Most Timely" subtitle="Best on-time delivery"
            developer={mostTimely.developer}
            value={`${mostTimely.onTimeDeliveryPct}% OTD`}
            color="var(--yuno-green-dark)"
            onClick={() => onDevClick(mostTimely.developer)}
          />
        )}
        {toughestOtd && (
          <AwardCard
            icon="💪" title="Toughest OTD" subtitle="High output + high OTD"
            developer={toughestOtd.developer}
            value={`WT ${toughestOtd.weightedTasks}, ${toughestOtd.onTimeDeliveryPct}% OTD`}
            color="var(--warning)"
            onClick={() => onDevClick(toughestOtd.developer)}
          />
        )}
        {roomToGrow && (
          <AwardCard
            icon="🌱" title="Room to Grow" subtitle="Opportunity to increase output"
            developer={roomToGrow.developer}
            value={`${roomToGrow.tasksCompleted} tasks, WT ${roomToGrow.weightedTasks}`}
            color="var(--muted)"
            onClick={() => onDevClick(roomToGrow.developer)}
          />
        )}
      </div>
    </SectionCard>
  );
}
