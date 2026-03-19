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


function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Def({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold w-36 shrink-0 text-[11px]" style={{ color }}>{label}</span>
      <span className="text-[11px] text-[var(--muted)]">{children}</span>
    </div>
  );
}

export default function MethodologyModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Methodology &amp; Metrics Guide</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Comprehensive guide to how every number is calculated</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-7">

          {/* ── 1. DATA SOURCES ── */}
          <Section title="Data Sources" color="var(--foreground-secondary)">
            <div className="space-y-2 text-[11px] text-[var(--muted)] leading-relaxed">
              <p>All data is pulled from <strong className="text-[var(--foreground)]">Jira REST API v3</strong> and cached as JSON files. A daily sync runs via GitHub Actions to keep the data up to date.</p>
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--surface)]">
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Board</th>
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Project</th>
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--accent)]">DEM</td>
                      <td className="py-2 px-3 text-[var(--foreground)]">Board 87</td>
                      <td className="py-2 px-3 text-[var(--muted)]">Integration requests, features, tech debt</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--oncall)]">YSHUB</td>
                      <td className="py-2 px-3 text-[var(--foreground)]">Service Desk</td>
                      <td className="py-2 px-3 text-[var(--muted)]">On-call support tickets, bug reports</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* ── 2. TASKS AT HAND FRAMEWORK ── */}
          <Section title="Tasks at Hand Framework — Weighted Tasks (WT)" color="var(--accent)">
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                <strong className="text-[var(--foreground)]">Weighted Tasks (WT)</strong> normalizes different types of integration work into comparable units.
                A developer completing one ISO integration (WT 7) contributes more than seven tech debt items (WT 1 each).
                WT only applies to DEM integration tasks. On-call tickets are measured by count, not weighted.
              </p>

              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] mt-2 mb-1">DEM Integration Weights (1–7 scale)</div>
              <p className="text-[11px] text-[var(--muted)] mb-2">
                Weight is determined automatically from the task summary: keywords like &ldquo;new integration&rdquo;, known provider names, and payment method types (Card, PIX, PSE, etc.) are matched to assign the appropriate weight.
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

              <p className="text-[11px] text-[var(--muted)] mt-3 leading-relaxed">
                <strong className="text-[var(--oncall)]">On-Call tickets</strong> are not weighted — they are measured by simple ticket count, SLA compliance, and resolution time.
              </p>
            </div>
          </Section>

          {/* ── 3. INTEGRATION REQUESTS (DEM) ── */}
          <Section title="Integration Requests (DEM Board)" color="var(--accent)">
            <div className="space-y-2">
              <Def label="Completed Tasks" color="var(--accent)">
                Count of Epics + standalone Stories (excluding &ldquo;Dev Validation&rdquo; stories) + Tech Debt items from the DEM board that changed to <strong className="text-[var(--foreground)]">Done</strong> or <strong className="text-[var(--foreground)]">Implementation Complete</strong> during the month. Only items still in that status are counted (reverted items are excluded).
              </Def>
              <Def label="Tasks / Developer" color="var(--accent)">
                Total Completed Tasks divided by the number of Active Developers (developers who completed at least 1 DEM task or resolved at least 1 YSHUB ticket in the month).
              </Def>
              <Def label="Active Developers" color="var(--accent)">
                Number of roster members who completed at least 1 DEM task or resolved at least 1 YSHUB ticket in the month.
              </Def>
              <Def label="On-Time Delivery (OTD%)" color="var(--accent)">
                Percentage of DEM tasks where the <code className="text-[10px] bg-[var(--surface)] px-1 rounded">statuscategorychangedate</code> (the date the task reached Done) was on or before the <code className="text-[10px] bg-[var(--surface)] px-1 rounded">duedate</code>. Tasks without a due date are excluded from this calculation.
              </Def>
              <Def label="Task Assignment" color="var(--accent)">
                Tasks are attributed to the developer in the Jira <strong className="text-[var(--foreground)]">Assignee</strong> field. The assignee name is matched to the team roster.
              </Def>
            </div>
          </Section>

          {/* ── 4. ON-CALL SUPPORT (YSHUB) ── */}
          <Section title="On-Call Support (YSHUB Board)" color="var(--oncall)">
            <div className="space-y-2">
              <Def label="Tickets Resolved (Team)" color="var(--oncall)">
                Total count of YSHUB tickets (component = Integration) that changed to <strong className="text-[var(--foreground)]">Done, Resolved, Closed, Canceled, or Deployment in Queue</strong> during the month. This includes <em>all</em> ticket types (Tasks, Bugs, etc.) and <em>all</em> final statuses including Canceled. This gives the full picture of team throughput.
              </Def>
              <Def label="Tickets (per Developer)" color="var(--oncall)">
                Individual developer ticket counts <em>exclude</em> Canceled tickets. Only tickets that reached Done, Resolved, Closed, or Deployment in Queue are counted at the individual level, since canceled tickets don&apos;t represent resolved work.
              </Def>
              <Def label="Ticket Assignment" color="var(--oncall)">
                On-call tickets are attributed to the developer in the Jira <strong className="text-[var(--foreground)]">Assignee</strong> field, matched to the team roster.
              </Def>
              <Def label="Definition of Done" color="var(--oncall)">
                A ticket is considered &ldquo;done&rdquo; when it reaches the <strong className="text-[var(--foreground)]">Deployment in Queue</strong> status. This is the point at which the fix has been implemented and is awaiting deployment. All SLA and resolution time metrics use this as the completion point.
              </Def>
            </div>
          </Section>

          {/* ── 5. SLA COMPLIANCE ── */}
          <Section title="SLA Compliance" color="var(--oncall)">
            <div className="space-y-2">
              <Def label="SLA %" color="var(--oncall)">
                Percentage of YSHUB tickets resolved within the SLA target for their priority level. Uses Jira&apos;s built-in <strong className="text-[var(--foreground)]">Time to Resolution</strong> SLA field (<code className="text-[10px] bg-[var(--surface)] px-1 rounded">customfield_10074</code>). If a ticket has a completed SLA cycle, the breach status is used directly.
              </Def>
              <Def label="SLA Fallback" color="var(--oncall)">
                When the Jira SLA field has no completed cycle (e.g., ticket was not tracked by the service desk), SLA is computed from <code className="text-[10px] bg-[var(--surface)] px-1 rounded">created</code> to <code className="text-[10px] bg-[var(--surface)] px-1 rounded">statuscategorychangedate</code> and compared against the priority-based goal: Highest = 72h, High = 48h, Medium = 72h, Low = 120h.
              </Def>
              <Def label="Median Resolution" color="var(--oncall)">
                Median elapsed time from the SLA clock (if available from Jira) or from ticket creation to status change date. Displayed in hours and days.
              </Def>
              <Def label="SLA by Priority" color="var(--oncall)">
                SLA targets per priority: <strong className="text-[var(--foreground)]">Highest = 3 days (72h)</strong>, <strong className="text-[var(--foreground)]">High = 2 days (48h)</strong>, <strong className="text-[var(--foreground)]">Medium = 3 days (72h)</strong>, <strong className="text-[var(--foreground)]">Low = 5 days (120h)</strong>.
              </Def>
            </div>
          </Section>

          {/* ── 6. BUGS-ONLY SLA ── */}
          <Section title="Bugs-Only SLA Analysis" color="var(--danger)">
            <div className="space-y-2">
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                A sub-analysis of SLA compliance considering only YSHUB tickets with <strong className="text-[var(--foreground)]">issue type = Bug</strong>. Not all bugs qualify — the filter depends on the environment and who reported the bug:
              </p>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--muted)] space-y-1">
                <div><strong className="text-[var(--foreground)]">Production bugs:</strong> Included regardless of who reported them (any reporter).</div>
                <div><strong className="text-[var(--foreground)]">Non-production bugs (SBX/STG):</strong> Only included if reported by a <em>merchant or company</em> (external reporter). Bugs reported internally by team members are excluded.</div>
              </div>
              <Def label="Internal vs External" color="var(--danger)">
                A reporter is considered &ldquo;internal&rdquo; if their name matches any entry in the team roster, or if the reporter is &ldquo;On Call Guardian&rdquo; or &ldquo;Atlassian Assist&rdquo; (automated reporters). Everyone else is treated as an external (merchant/company) reporter.
              </Def>
              <Def label="Environment" color="var(--danger)">
                Determined from the Jira <strong className="text-[var(--foreground)]">Environment</strong> field (<code className="text-[10px] bg-[var(--surface)] px-1 rounded">customfield_10196</code>). Values containing &ldquo;production&rdquo; or &ldquo;prod&rdquo; are classified as Production.
              </Def>
            </div>
          </Section>

          {/* ── 7. BUGS ── */}
          <Section title="Bug Tracking" color="var(--danger)">
            <div className="space-y-2">
              <Def label="PROD Bugs (KPI)" color="var(--danger)">
                Count of YSHUB tickets (any type) that have the <strong className="text-[var(--foreground)]">Responsible Party of the Bug</strong> field (<code className="text-[10px] bg-[var(--surface)] px-1 rounded">customfield_14104</code>) filled and matching a team roster member. This is the team-level KPI shown in the top cards.
              </Def>
              <Def label="In-Sprint Bugs (DEM)" color="var(--warning)">
                Issues of type <strong className="text-[var(--foreground)]">In-Sprint Bug</strong> from the DEM board, attributed by Jira Assignee. These are bugs found during development/QA before reaching production.
              </Def>
              <Def label="YSHUB Bugs" color="var(--danger)">
                Issues of type <strong className="text-[var(--foreground)]">Bug</strong> from the YSHUB board (component = Integration), created during the month. These appear in the Bugs view grouped by provider.
              </Def>
              <Def label="Per-Developer Bugs" color="var(--danger)">
                In the developer profile, bugs are shown in two sections: <strong className="text-[var(--foreground)]">In-Sprint Bugs (DEM)</strong> assigned to the developer, and <strong className="text-[var(--foreground)]">Production Bugs (YSHUB)</strong> where the developer is listed as Responsible Party.
              </Def>
              <Def label="Reporting Type" color="var(--danger)">
                Each YSHUB bug has a <strong className="text-[var(--foreground)]">Reporting Type</strong> field (<code className="text-[10px] bg-[var(--surface)] px-1 rounded">customfield_11877</code>) indicating who reported it: <strong className="text-[var(--foreground)]">Merchant</strong> (external client), <strong className="text-[var(--foreground)]">Team</strong> (found internally), or <strong className="text-[var(--foreground)]">Unknown</strong> (not set). This is shown in the bugs-by-provider bars and table.
              </Def>
              <Def label="Bug Environment" color="var(--danger)">
                Determined from the Jira <strong className="text-[var(--foreground)]">Environment</strong> field. Classified as PROD (production), SBX (sandbox/dev), or STG (staging).
              </Def>
              <Def label="Bug Provider" color="var(--danger)">
                Read from the Jira <strong className="text-[var(--foreground)]">Providers</strong> field (<code className="text-[10px] bg-[var(--surface)] px-1 rounded">customfield_10229</code>). This is the payment provider associated with the bug.
              </Def>
            </div>
          </Section>

          {/* ── 8. INSIGHTS & AWARDS ── */}
          <Section title="Insights &amp; Awards" color="var(--foreground-secondary)">
            <div className="space-y-2">
              <Def label="Highest Output" color="var(--accent)">
                Developer with the highest Weighted Tasks (WT) in the month. Only DEM integration tasks are weighted.
              </Def>
              <Def label="Most Timely" color="var(--accent)">
                Developer with the highest On-Time Delivery % (minimum 1 task with a due date).
              </Def>
              <Def label="Bug-Free" color="var(--success)">
                Developers who completed at least 1 DEM task and had zero PROD bugs and zero SBX bugs.
              </Def>
              <Def label="Ticket Machine" color="var(--oncall)">
                Developer who resolved the most YSHUB tickets in the month.
              </Def>
              <Def label="Fastest Resolution" color="var(--oncall)">
                Developer with the lowest median resolution time (minimum 3 tickets resolved).
              </Def>
              <Def label="SLA Champion" color="var(--oncall)">
                Developer with the highest SLA compliance % (minimum 3 tickets resolved).
              </Def>
              <Def label="Helping Hand" color="var(--oncall)">
                Non-dedicated on-call developer who resolved the most YSHUB tickets. Recognizes integration developers who volunteered for support duty.
              </Def>
            </div>
          </Section>

          {/* ── 9. TEAM STRUCTURE ── */}
          <Section title="Team Structure &amp; Squads" color="var(--foreground-secondary)">
            <div className="space-y-2 text-[11px] text-[var(--muted)] leading-relaxed">
              <p>The team roster is maintained in a JSON file and can be edited via the <strong className="text-[var(--foreground)]">Team</strong> page. Each developer belongs to a squad and has a list of Jira display names used for matching.</p>
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--surface)]">
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Squad</th>
                      <th className="py-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--accent)]">The Hallows</td>
                      <td className="py-2 px-3">Integration development</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--accent)]">Mortifagos</td>
                      <td className="py-2 px-3">Integration development</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--accent)]">Dementors</td>
                      <td className="py-2 px-3">Integration development</td>
                    </tr>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-3 font-semibold text-[var(--oncall)]">Dedicated On-Call</td>
                      <td className="py-2 px-3">Full-time YSHUB support</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>Developers can be <strong className="text-[var(--foreground)]">deactivated</strong> if they leave the team. Deactivated members still appear in historical data but are tagged in the UI.</p>
              <p>The <strong className="text-[var(--foreground)]">Active From / Active To</strong> fields on roster entries control which months a developer appears in, ensuring accurate per-month calculations.</p>
            </div>
          </Section>

          {/* ── 10. DATA PIPELINE ── */}
          <Section title="Data Pipeline &amp; Caching" color="var(--foreground-secondary)">
            <div className="space-y-2 text-[11px] text-[var(--muted)] leading-relaxed">
              <p><strong className="text-[var(--foreground)]">Daily sync:</strong> A GitHub Actions cron job runs every day, pulling fresh data from Jira for all months. Results are cached as <code className="text-[10px] bg-[var(--surface)] px-1 rounded">data/sync-YYYY-MM.json</code> files and committed to the repo.</p>
              <p><strong className="text-[var(--foreground)]">Request flow:</strong> Dashboard request &rarr; in-memory cache (1h TTL) &rarr; on-disk JSON &rarr; live Jira API (fallback). Most requests are served from cache without hitting Jira.</p>
              <p><strong className="text-[var(--foreground)]">Manual sync:</strong> Can be triggered via the <code className="text-[10px] bg-[var(--surface)] px-1 rounded">/api/sync</code> endpoint. This forces a fresh pull from Jira and updates both the in-memory and disk caches.</p>
              <p><strong className="text-[var(--foreground)]">Partial month:</strong> The current month is always a partial data set. Trend charts mark the current month&apos;s data point with a dashed style to indicate it&apos;s incomplete.</p>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
