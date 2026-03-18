"use client";

import { useEffect, useState } from "react";

interface KpiCardProps {
  label: string;
  subtitle?: string;
  value: number;
  suffix?: string;
  prefix?: string;
  prevValue?: number;
  color?: string;
  invertDelta?: boolean;
  deltaLabel?: string;
}

export default function KpiCard({ label, subtitle, value, suffix = "", prefix = "", prevValue, color = "var(--accent)", invertDelta, deltaLabel }: KpiCardProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 500;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(+(value * eased).toFixed(1));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const delta = prevValue !== undefined ? value - prevValue : null;
  const isPositive = invertDelta ? (delta !== null && delta <= 0) : (delta !== null && delta >= 0);
  const displayVal = Number.isInteger(value) ? Math.round(displayed) : displayed;
  const deltaNum = delta !== null ? (Number.isInteger(delta) ? delta : +delta.toFixed(1)) : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3.5 hover:border-[var(--border-light)] hover:bg-[var(--card-hover)] transition-all duration-200 min-w-0 flex flex-col">
      {/* Label — fixed height */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-secondary)] truncate">{label}</div>
      {/* Subtitle — fixed height area */}
      <div className="text-[9px] text-[var(--muted)] leading-tight min-h-[22px] flex items-start">
        {subtitle || ""}
      </div>
      {/* Value */}
      <div className="mt-auto pt-1">
        <span className="text-2xl font-bold leading-none" style={{ color }}>
          {prefix}{displayVal}{suffix}
        </span>
      </div>
      {/* Delta — fixed height area */}
      <div className="h-[18px] mt-1.5 flex items-center">
        {deltaNum !== null ? (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold leading-none ${isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none">
              {isPositive ? (
                <path d="M6 2.5L10 7H2L6 2.5Z" fill="currentColor" />
              ) : (
                <path d="M6 9.5L2 5H10L6 9.5Z" fill="currentColor" />
              )}
            </svg>
            <span className="tabular-nums whitespace-nowrap">
              {Math.abs(deltaNum)}{deltaLabel || suffix} vs prev. month
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
