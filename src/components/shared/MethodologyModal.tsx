"use client";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEM_WEIGHTS = [
  { weight: 7, type: "ISO Integration", description: "BBVA, Diners, JP Morgan — full ISO-level integrations", color: "var(--danger)" },
  { weight: 6, type: "New Integration — Multiple Methods", description: "New provider with Card + APM or 3+ payment methods", color: "var(--warning)" },
  { weight: 5, type: "New Integration — APM", description: "New provider with alternative payment method (PIX, PSE, OXXO, etc.)", color: "var(--warning)" },
  { weight: 4, type: "New Integration — Cards", description: "New provider connector, cards only", color: "var(--accent)" },
  { weight: 3, type: "APM — Existing Provider", description: "Adding APM to an already-connected provider", color: "var(--accent)" },
  { weight: 2, type: "Card — Existing Provider", description: "Card integration from an existing provider connector", color: "var(--accent)" },
  { weight: 1, type: "Tech Debt", description: "Refactoring, cleanup, translations, internal improvements", color: "var(--muted)" },
];

const ONCALL_WEIGHTS = [
  { weight: 3, priority: "Highest", sla: "24h", color: "var(--danger)" },
  { weight: 2, priority: "High", sla: "48h", color: "var(--warning)" },
  { weight: 1.5, priority: "Medium", sla: "5 days", color: "var(--accent)" },
  { weight: 1, priority: "Low", sla: "10 days", color: "var(--muted)" },
];

export default function MethodologyModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Scoring Methodology</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">How Weighted Tasks (WT) are calculated</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* What is WT */}
          <div>
            <p className="text-[13px] text-[var(--foreground-secondary)] leading-relaxed">
              <strong className="text-[var(--foreground)]">Weighted Tasks (WT)</strong> normalizes different types of work into comparable units.
              A developer completing one ISO integration (WT 7) contributes more than seven tech debt items (WT 1 each).
              WT is the sum of all weighted DEM tasks plus weighted YSHUB on-call tickets.
            </p>
          </div>

          {/* DEM Weights */}
          <div>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)] mb-3">
              Integration Tasks (DEM Board)
            </h3>
            <p className="text-[11px] text-[var(--muted)] mb-3">
              Based on the &ldquo;Tasks at Hand&rdquo; framework. Weight is determined by checking the PRIOR board for provider type,
              &ldquo;Is this a new provider connector?&rdquo; field, and the DEM &ldquo;Implementation Type&rdquo; field.
            </p>
            <div className="space-y-1.5">
              {DEM_WEIGHTS.map(w => (
                <div key={w.weight} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ color: w.color, backgroundColor: `color-mix(in srgb, ${w.color} 15%, transparent)` }}>
                    {w.weight}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--foreground)]">{w.type}</div>
                    <div className="text-[10px] text-[var(--muted)]">{w.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* On-Call Weights */}
          <div>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--oncall)] mb-3">
              On-Call Tickets (YSHUB)
            </h3>
            <p className="text-[11px] text-[var(--muted)] mb-3">
              YSHUB tickets are weighted by Jira priority. SLA targets are set directly in Jira&apos;s service desk configuration.
              SLA compliance uses the built-in &ldquo;Time to resolution&rdquo; breach status.
            </p>
            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[var(--surface)]">
                    <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Priority</th>
                    <th className="py-2 px-3 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Weight</th>
                    <th className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">SLA Target</th>
                  </tr>
                </thead>
                <tbody>
                  {ONCALL_WEIGHTS.map(w => (
                    <tr key={w.priority} className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold" style={{ color: w.color }}>{w.priority}</td>
                      <td className="py-2 px-3 text-center font-bold tabular-nums" style={{ color: w.color }}>{w.weight}</td>
                      <td className="py-2 px-3 text-right text-[var(--foreground-secondary)] tabular-nums">{w.sla}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Other definitions */}
          <div>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--foreground-secondary)] mb-3">
              Other Metrics
            </h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex gap-2">
                <span className="font-bold text-[var(--accent)] w-28 shrink-0">DEM Tasks</span>
                <span className="text-[var(--muted)]">Epics + standalone Stories (excl. Dev Validation) + Tech Debt items that reached Done or Implementation Complete.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--accent)] w-28 shrink-0">OTD %</span>
                <span className="text-[var(--muted)]">% of DEM tasks where the status changed to Done/Implementation Complete on or before the due date.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--danger)] w-28 shrink-0">PROD Bugs</span>
                <span className="text-[var(--muted)]">YSHUB tickets with the &ldquo;Responsible Party of the Bug&rdquo; field filled, attributed to the named developer.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--warning)] w-28 shrink-0">SBX Bugs</span>
                <span className="text-[var(--muted)]">In-Sprint Bugs from DEM board assigned to the developer (found during QA/testing).</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--oncall)] w-28 shrink-0">SLA %</span>
                <span className="text-[var(--muted)]">% of YSHUB tickets where Jira&apos;s &ldquo;Time to resolution&rdquo; SLA was not breached.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-[var(--oncall)] w-28 shrink-0">Resolution Time</span>
                <span className="text-[var(--muted)]">Median elapsed time from the SLA clock (business hours as configured in Jira).</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
