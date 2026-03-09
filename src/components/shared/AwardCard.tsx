"use client";

interface AwardCardProps {
  title: string;
  subtitle: string;
  developer: string;
  value: string;
  icon: string;
  color?: string;
  onClick?: () => void;
}

export default function AwardCard({ title, subtitle, developer, value, icon, color = "var(--accent)", onClick }: AwardCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 transition-all duration-200 hover:border-[var(--border-light)] hover:bg-[var(--surface-hover)] ${onClick ? "cursor-pointer" : ""}`}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</div>
          <div className="text-[11px] text-[var(--muted-dim)]">{subtitle}</div>
        </div>
      </div>
      <div className="mt-auto">
        <div className="text-[15px] font-bold text-[var(--foreground)] group-hover:text-white transition-colors truncate">{developer}</div>
        <div className="text-xs font-medium mt-0.5" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}
