"use client";

import { DeveloperMonthly, MonthlyTeamMetrics } from "@/lib/types";
import { getAiAdoptionCategories } from "@/lib/scoring";
import TrendChart from "../shared/TrendChart";
import SectionCard from "../shared/SectionCard";

interface Props {
  developers: DeveloperMonthly[];
  teamData: MonthlyTeamMetrics[];
  onDevClick: (name: string) => void;
}

function BarRow({ name, value, max, onClick }: { name: string; value: number; max: number; onClick: () => void }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value < 40 ? "var(--danger)" : value > 70 ? "var(--yuno-green)" : "var(--yuno-blue)";
  return (
    <button onClick={onClick} className="flex items-center gap-2 group w-full text-left hover:bg-[var(--surface-hover)] rounded-lg px-2 py-1.5 -mx-2 transition-colors">
      <span className="text-xs text-[var(--foreground)] w-28 truncate group-hover:text-white transition-colors">{name}</span>
      <div className="flex-1 h-5 bg-[var(--border)]/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full animate-grow transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color }}>{value}%</span>
    </button>
  );
}

export default function AIAdoption({ developers, teamData, onDevClick }: Props) {
  const { topAdopter, risingStars, belowThreshold } = getAiAdoptionCategories(developers);
  const sorted = [...developers].sort((a, b) => b.aiCodeRatio - a.aiCodeRatio);
  const avgRatio = developers.length > 0 ? Math.round(developers.reduce((s, d) => s + d.aiCodeRatio, 0) / developers.length) : 0;

  return (
    <SectionCard title="AI Adoption" subtitle={`Team avg: ${avgRatio}%`}>
      <div className="space-y-4">
        {/* Custom bar rows */}
        <div className="space-y-0.5 max-h-[350px] overflow-y-auto pr-1">
          {sorted.map(d => (
            <BarRow key={d.developer} name={d.developer} value={d.aiCodeRatio} max={100} onClick={() => onDevClick(d.developer)} />
          ))}
        </div>

        {/* Team avg trend */}
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="text-[11px] font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Team Trend</div>
          <TrendChart
            data={teamData}
            xKey="month"
            areas={[{ key: "teamAiRatio", color: "var(--yuno-blue)", name: "Team AI %" }]}
            yDomain={[0, 100]}
            yFormatter={(v) => `${v}%`}
            height={120}
          />
        </div>

        {/* Highlight chips */}
        <div className="flex flex-wrap gap-1.5">
          {topAdopter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--yuno-green)]/10 border border-[var(--yuno-green)]/20 px-2.5 py-1 text-[11px] text-[var(--yuno-green)] font-medium">
              Top: {topAdopter.developer} ({topAdopter.aiCodeRatio}%)
            </span>
          )}
          {belowThreshold.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/20 px-2.5 py-1 text-[11px] text-[var(--danger)] font-medium">
              Below 40%: {belowThreshold.length} dev{belowThreshold.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
