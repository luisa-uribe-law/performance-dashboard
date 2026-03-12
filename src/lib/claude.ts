import { PerformanceData, DeveloperMonthly, MonthlyTeamMetrics } from "./types";
import { computeSpeedAwards, computeOnCallHeroes, computeHelpingHand, getBugFreeDevs } from "./scoring";

// ── Tool definitions for Claude ──

export const TOOL_DEFINITIONS = [
  {
    name: "get_developer_metrics",
    description: "Get detailed performance metrics for a specific developer in a given month. Returns tasks completed, weighted tasks, OTD%, bugs, on-call tickets, SLA, resolution time, and lists of individual tickets.",
    input_schema: {
      type: "object" as const,
      properties: {
        developer: { type: "string", description: "Developer name (e.g. 'Juan Quintana'). Partial match supported." },
        month: { type: "string", description: "Month in YYYY-MM format (e.g. '2026-02'). If omitted, returns all available months." },
      },
      required: ["developer"],
    },
  },
  {
    name: "get_team_summary",
    description: "Get team-level KPIs for a given month: total tasks, tasks/developer, OTD%, bugs, tickets resolved, SLA%, median resolution.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format (e.g. '2026-02')." },
      },
      required: ["month"],
    },
  },
  {
    name: "compare_months",
    description: "Compare team-level KPIs across two months. Shows the delta for each metric. Useful for trend analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        month_a: { type: "string", description: "First month (YYYY-MM)" },
        month_b: { type: "string", description: "Second month (YYYY-MM)" },
      },
      required: ["month_a", "month_b"],
    },
  },
  {
    name: "get_rankings",
    description: "Get ranked lists of developers by a specific metric for a given month. Supports: tasksCompleted, weightedTasks, onTimeDeliveryPct, prodBugs, sbxBugs, ticketsResolved, slaCompliancePct, medianResolutionHrs.",
    input_schema: {
      type: "object" as const,
      properties: {
        metric: { type: "string", description: "The metric to rank by" },
        month: { type: "string", description: "Month in YYYY-MM format" },
        group: { type: "string", description: "Optional group filter: 'all', 'the-hallows', 'mortifagos', 'dementors', 'dedicated-oncall'. Default: 'all'." },
        limit: { type: "number", description: "Number of top results to return. Default: 10." },
        order: { type: "string", description: "'desc' for highest first (default), 'asc' for lowest first." },
      },
      required: ["metric", "month"],
    },
  },
  {
    name: "get_awards",
    description: "Get computed awards and highlights for a month: highest output, most timely, on-call heroes (ticket machine, fastest resolution, SLA champion), helping hand, bug-free developers.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format" },
      },
      required: ["month"],
    },
  },
  {
    name: "get_bugs_detail",
    description: "Get detailed bug information for developers in a given month. Shows PROD and SBX bugs with Jira ticket keys, summaries, and integration/provider info.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format" },
        developer: { type: "string", description: "Optional: filter to a specific developer name" },
      },
      required: ["month"],
    },
  },
  {
    name: "list_available_months",
    description: "List all available months that have performance data.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_squad_breakdown",
    description: "Get aggregated metrics broken down by squad for a given month. Shows totals and averages per squad.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format" },
      },
      required: ["month"],
    },
  },
];

// ── Tool execution ──

function findDeveloper(devs: DeveloperMonthly[], name: string): DeveloperMonthly[] {
  const lower = name.toLowerCase();
  return devs.filter(d => d.developer.toLowerCase().includes(lower));
}

function devSummary(d: DeveloperMonthly) {
  return {
    developer: d.developer,
    month: d.month,
    group: d.group,
    role: d.role,
    tasksCompleted: d.tasksCompleted,
    weightedTasks: d.weightedTasks,
    onTimeDeliveryPct: d.onTimeDeliveryPct,
    prodBugs: d.prodBugs,
    sbxBugs: d.sbxBugs,
    ticketsResolved: d.ticketsResolved,
    slaCompliancePct: d.slaCompliancePct,
    medianResolutionHrs: d.medianResolutionHrs,
    medianResolutionDays: d.medianResolutionHrs > 0 ? +(d.medianResolutionHrs / 24).toFixed(1) : 0,
    integrations: d.integrations.map(t => ({ key: t.key, summary: t.summary, weight: t.weightedTasks, onTime: t.onTime })),
    bugs: d.bugs.map(b => ({ key: b.key, summary: b.summary, env: b.env, provider: b.provider })),
    onCallTickets: d.onCallTickets.length > 0
      ? d.onCallTickets.map(t => ({ key: t.key, summary: t.summary, priority: t.priority, slaBreached: t.slaBreached, resolutionHrs: t.resolutionHrs }))
      : undefined,
  };
}

export function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  data: PerformanceData
): string {
  switch (toolName) {
    case "get_developer_metrics": {
      const name = input.developer as string;
      const month = input.month as string | undefined;
      let matches = findDeveloper(data.developerMetrics, name);
      if (month) matches = matches.filter(d => d.month === month);
      if (matches.length === 0) return JSON.stringify({ error: `No data found for developer matching '${name}'${month ? ` in ${month}` : ""}` });
      return JSON.stringify(matches.map(devSummary));
    }

    case "get_team_summary": {
      const month = input.month as string;
      const team = data.teamMetrics.find(t => t.month === month);
      if (!team) return JSON.stringify({ error: `No team data for ${month}` });
      const priority = data.onCallPriority.filter(p => p.month === month);
      return JSON.stringify({ ...team, onCallByPriority: priority });
    }

    case "compare_months": {
      const a = data.teamMetrics.find(t => t.month === (input.month_a as string));
      const b = data.teamMetrics.find(t => t.month === (input.month_b as string));
      if (!a || !b) return JSON.stringify({ error: `Missing data for one or both months` });
      const delta: Record<string, unknown> = {};
      for (const key of Object.keys(a) as (keyof MonthlyTeamMetrics)[]) {
        if (key === "month") continue;
        const va = a[key] as number;
        const vb = b[key] as number;
        delta[key] = { [a.month]: va, [b.month]: vb, delta: +(vb - va).toFixed(2) };
      }
      return JSON.stringify(delta);
    }

    case "get_rankings": {
      const month = input.month as string;
      const metric = input.metric as keyof DeveloperMonthly;
      const group = (input.group as string) || "all";
      const limit = (input.limit as number) || 10;
      const order = (input.order as string) || "desc";
      let devs = data.developerMetrics.filter(d => d.month === month);
      if (group !== "all") devs = devs.filter(d => d.group === group);
      devs = [...devs].sort((a, b) => {
        const va = a[metric] as number;
        const vb = b[metric] as number;
        return order === "asc" ? va - vb : vb - va;
      });
      return JSON.stringify(devs.slice(0, limit).map((d, i) => ({
        rank: i + 1,
        developer: d.developer,
        group: d.group,
        [metric]: d[metric],
      })));
    }

    case "get_awards": {
      const month = input.month as string;
      const devs = data.developerMetrics.filter(d => d.month === month);
      const speed = computeSpeedAwards(devs);
      const heroes = computeOnCallHeroes(devs);
      const helping = computeHelpingHand(devs);
      const bugFree = getBugFreeDevs(devs);
      return JSON.stringify({
        integrationHighlights: {
          highestOutput: speed.highestOutput ? { developer: speed.highestOutput.developer, weightedTasks: speed.highestOutput.weightedTasks, tasksCompleted: speed.highestOutput.tasksCompleted } : null,
          mostTimely: speed.mostTimely ? { developer: speed.mostTimely.developer, onTimeDeliveryPct: speed.mostTimely.onTimeDeliveryPct, tasksCompleted: speed.mostTimely.tasksCompleted } : null,
          bugFreeDevelopers: bugFree,
        },
        onCallHighlights: {
          ticketMachine: heroes?.ticketMachine ? { developer: heroes.ticketMachine.developer, ticketsResolved: heroes.ticketMachine.ticketsResolved, slaCompliancePct: heroes.ticketMachine.slaCompliancePct } : null,
          fastestResolution: heroes?.fastestResolution ? { developer: heroes.fastestResolution.developer, medianResolutionHrs: heroes.fastestResolution.medianResolutionHrs, medianResolutionDays: +(heroes.fastestResolution.medianResolutionHrs / 24).toFixed(1) } : null,
          slaChampion: heroes?.slaChampion ? { developer: heroes.slaChampion.developer, slaCompliancePct: heroes.slaChampion.slaCompliancePct, ticketsResolved: heroes.slaChampion.ticketsResolved } : null,
          helpingHand: helping ? { developer: helping.developer, ticketsResolved: helping.ticketsResolved, slaCompliancePct: helping.slaCompliancePct } : null,
        },
      });
    }

    case "get_bugs_detail": {
      const month = input.month as string;
      let devs = data.developerMetrics.filter(d => d.month === month);
      if (input.developer) devs = findDeveloper(devs, input.developer as string);
      const result = devs
        .filter(d => d.bugs.length > 0)
        .map(d => ({
          developer: d.developer,
          group: d.group,
          bugs: d.bugs.map(b => ({
            key: b.key,
            summary: b.summary,
            env: b.env,
            provider: b.provider,
            jiraUrl: `https://yunopayments.atlassian.net/browse/${b.key}`,
          })),
        }));
      if (result.length === 0) return JSON.stringify({ message: `No bugs found${input.developer ? ` for '${input.developer}'` : ""} in ${month}` });
      return JSON.stringify(result);
    }

    case "list_available_months": {
      const months = [...new Set(data.teamMetrics.map(t => t.month))].sort();
      return JSON.stringify({ availableMonths: months });
    }

    case "get_squad_breakdown": {
      const month = input.month as string;
      const devs = data.developerMetrics.filter(d => d.month === month);
      const squads = new Map<string, DeveloperMonthly[]>();
      for (const d of devs) {
        if (!squads.has(d.group)) squads.set(d.group, []);
        squads.get(d.group)!.push(d);
      }
      const result: Record<string, unknown> = {};
      for (const [squad, members] of squads) {
        const count = members.length;
        result[squad] = {
          developers: count,
          totalTasks: members.reduce((s, d) => s + d.tasksCompleted, 0),
          totalWeightedTasks: members.reduce((s, d) => s + d.weightedTasks, 0),
          avgOtd: count > 0 ? +(members.reduce((s, d) => s + d.onTimeDeliveryPct, 0) / count).toFixed(1) : 0,
          totalProdBugs: members.reduce((s, d) => s + d.prodBugs, 0),
          totalSbxBugs: members.reduce((s, d) => s + d.sbxBugs, 0),
          totalTicketsResolved: members.reduce((s, d) => s + d.ticketsResolved, 0),
          avgSla: count > 0 ? +(members.reduce((s, d) => s + d.slaCompliancePct, 0) / count).toFixed(1) : 0,
          members: members.map(d => d.developer),
        };
      }
      return JSON.stringify(result);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ── System prompt ──

export function buildSystemPrompt(data: PerformanceData, currentMonth: string): string {
  // Inject current month's data as context (hybrid approach)
  const currentDevs = data.developerMetrics.filter(d => d.month === currentMonth);
  const currentTeam = data.teamMetrics.find(t => t.month === currentMonth);
  const availableMonths = [...new Set(data.teamMetrics.map(t => t.month))].sort();

  const compactDevs = currentDevs.map(d => ({
    name: d.developer,
    group: d.group,
    role: d.role,
    tasks: d.tasksCompleted,
    wt: d.weightedTasks,
    otd: d.onTimeDeliveryPct,
    prodBugs: d.prodBugs,
    sbxBugs: d.sbxBugs,
    tickets: d.ticketsResolved,
    sla: d.slaCompliancePct,
    resHrs: d.medianResolutionHrs,
  }));

  return `You are the **Integrations Team Performance Agent** for Yuno's integrations team. You help leadership and team members understand performance data through insightful, data-driven analysis.

## Your Personality
- Direct and constructive — lead with data, not fluff
- Use the exact numbers from the data — never guess or make up values
- When comparing developers, be fair and consider context (squad, role, group)
- Highlight both achievements and areas for improvement constructively
- Use bullet points and concise formatting for readability
- When mentioning Jira tickets, include the key (e.g. DEM-1234, YSHUB-5678)

## Team Structure
The Integrations team has ~26 developers organized into:
- **Squads**: The Hallows, Mortifagos, Dementors (integration work), and Dedicated On-Call (support)
- **Groups**: Integration developers work on the DEM board (new integrations, payment methods). Dedicated on-call handles YSHUB support tickets.
- Some integration developers also pick up YSHUB tickets on rotation — these are the "Helping Hand" contributors.

## Scoring Methodology — "Tasks at Hand"

### DEM Integration Weights (1-7 scale)
| Weight | Type | Description |
|--------|------|-------------|
| 7 | ISO Integration | BBVA, Diners, JP Morgan — full ISO-level integrations |
| 6 | New Integration — Multiple Methods | New provider with Card + APM or 3+ payment methods |
| 5 | New Integration — APM | New provider with alternative payment method |
| 4 | New Integration — Cards | New provider connector, cards only |
| 3 | APM — Existing Provider | Adding APM to an already-connected provider |
| 2 | Card — Existing Provider | Card integration on existing connector |
| 1 | Tech Debt | Refactoring, cleanup, internal improvements |

### On-Call Ticket Weights (by Jira priority)
| Priority | Weight | SLA Target |
|----------|--------|------------|
| Highest | 3 | 24 hours |
| High | 2 | 48 hours |
| Medium | 1.5 | 5 days |
| Low | 1 | 10 days |

**Weighted Tasks (WT)** = sum of all ticket weights for a developer. Allows fair comparison regardless of ticket type or complexity.

## Metrics Definitions
- **DEM Tasks**: Epics + standalone Stories (excl. Dev Validation) + Tech Debt that reached Done or Implementation Complete
- **On-Call Tickets**: YSHUB tickets (component=Integration) resolved by the developer
- **Weighted Tasks (WT)**: Complexity-adjusted total work output (DEM weights + YSHUB weights)
- **On-Time Delivery (OTD%)**: % of DEM tasks completed by their due date
- **PROD Bugs**: Production bugs attributed via Jira "Responsible Party of the Bug" field
- **SBX Bugs**: In-Sprint Bugs from DEM board (found during QA/testing)
- **SLA Compliance**: % of YSHUB tickets resolved within SLA target (a ticket is considered "done" once it reaches "Deployment in Queue" status)
- **Median Resolution**: Median elapsed time from ticket creation to reaching "Deployment in Queue" status

## Available Data
Months with data: ${availableMonths.join(", ")}
Currently viewing: **${currentMonth}**

## Current Month Snapshot (${currentMonth})
${currentTeam ? `Team KPIs: ${currentTeam.tasksCompleted} tasks, ${currentTeam.tasksPerDeveloper} tasks/dev, ${currentTeam.onTimeDeliveryPct}% OTD, ${currentTeam.prodBugs} PROD bugs, ${currentTeam.sbxBugs} SBX bugs, ${currentTeam.ticketsResolved} tickets, ${currentTeam.slaCompliancePct}% SLA` : "No team data"}

Developers (${currentDevs.length}):
${JSON.stringify(compactDevs)}

## Tools
You have access to tools to query the full dataset across all months. Use them when you need:
- Historical data or month-over-month comparisons
- Detailed individual ticket breakdowns
- Rankings across the team
- Squad-level breakdowns
- Bug details with Jira links

For the current month (${currentMonth}), you already have the data above — use it directly without calling tools.

## Response Guidelines
- Keep responses concise — aim for 3-8 bullet points for most questions
- Use markdown formatting: **bold** for names/numbers, bullet lists, tables when comparing
- When asked "how did X do?", cover their key metrics and highlight standouts (good or bad)
- When asked to compare, use a table format
- Always ground analysis in specific numbers from the data`;
}
