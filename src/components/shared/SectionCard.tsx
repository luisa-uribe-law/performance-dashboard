"use client";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function SectionCard({ title, subtitle, action, children, className = "" }: SectionCardProps) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--border-light)] ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
