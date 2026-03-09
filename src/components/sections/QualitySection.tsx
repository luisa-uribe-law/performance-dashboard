"use client";

import { DeveloperMonthly, MonthlyTeamMetrics } from "@/lib/types";
import { getBugFreeDevs } from "@/lib/scoring";
import TrendChart from "../shared/TrendChart";
import SectionCard from "../shared/SectionCard";

interface Props {
  developers: DeveloperMonthly[];
  teamData: MonthlyTeamMetrics[];
  onDevClick: (name: string) => void;
}

export default function QualitySection({ developers, teamData, onDevClick }: Props) {
  const bugFree = getBugFreeDevs(developers);
  const needsWork = developers
    .filter(d => d.prodBugs > 0)
    .sort((a, b) => b.prodBugs - a.prodBugs)
    .slice(0, 3);

  return (
    <SectionCard title="Quality" subtitle="Bug tracking & trends">
      <div className="space-y-4">
        <TrendChart
          data={teamData}
          xKey="month"
          bars={[
            { key: "prodBugs", color: "var(--danger)", name: "PROD Bugs" },
            { key: "sbxBugs", color: "var(--warning)", name: "SBX Bugs" },
          ]}
          height={170}
        />

        {bugFree.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Bug-Free</div>
            <div className="flex flex-wrap gap-1.5">
              {bugFree.map(name => (
                <button
                  key={name}
                  onClick={() => onDevClick(name)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20 px-2.5 py-1 text-[11px] text-[var(--success)] font-medium hover:bg-[var(--success)]/20 transition-colors cursor-pointer"
                >
                  ✓ {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {needsWork.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Needs Attention</div>
            <div className="flex flex-wrap gap-1.5">
              {needsWork.map(d => (
                <button
                  key={d.developer}
                  onClick={() => onDevClick(d.developer)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-2.5 py-1 text-[11px] text-[var(--danger)] font-medium hover:bg-[var(--danger)]/20 transition-colors cursor-pointer"
                >
                  {d.developer} ({d.prodBugs} PROD)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
