import { PerformanceData, DeveloperMonthly, MonthlyTeamMetrics } from "./types";
import { computeSpeedAwards, computeOnCallHeroes, computeHelpingHand, getAiAdoptionCategories, getBugFreeDevs } from "./scoring";

// ── Rule-based chat engine ──
// No tables — uses bullet/card format optimized for narrow chat panel.

interface QueryContext {
  data: PerformanceData;
  currentMonth: string;
}

interface ParsedIntent {
  type: string;
  params: Record<string, string>;
}

// ── Intent parsing ──

function parseIntent(input: string, ctx: QueryContext): ParsedIntent {
  const q = input.toLowerCase().trim();

  // Compare months
  const compareMonthsMatch = q.match(/compare\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(?:vs?\.?\s+|and\s+|with\s+)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i);
  if (compareMonthsMatch || q.includes("compare month") || q.includes("month over month") || q.includes("mom")) {
    if (compareMonthsMatch) {
      const a = resolveMonthName(compareMonthsMatch[1], ctx);
      const b = resolveMonthName(compareMonthsMatch[2], ctx);
      return { type: "compare_months", params: { month_a: a, month_b: b } };
    }
    const months = getAvailableMonths(ctx);
    if (months.length >= 2) {
      return { type: "compare_months", params: { month_a: months[months.length - 2], month_b: months[months.length - 1] } };
    }
  }

  // Compare squads
  if (q.includes("squad") && (q.includes("compare") || q.includes("breakdown") || q.includes("versus") || q.includes("vs"))) {
    return { type: "squad_breakdown", params: { month: ctx.currentMonth } };
  }
  if (q.includes("compare squad") || q.includes("squad breakdown") || q.includes("squads this month") || q.includes("squad comparison")) {
    return { type: "squad_breakdown", params: { month: ctx.currentMonth } };
  }

  // Developer-specific
  const devMatch = findDeveloperInQuery(q, ctx);
  if (devMatch) {
    return { type: "developer_detail", params: { developer: devMatch } };
  }

  // Bug-related
  if (q.includes("bug")) {
    if (q.includes("free") || q.includes("zero") || q.includes("no bug") || q.includes("0 bug")) {
      return { type: "bug_free", params: { month: ctx.currentMonth } };
    }
    return { type: "bugs_detail", params: { month: ctx.currentMonth } };
  }

  // AI adoption
  if (q.includes("ai") && (q.includes("adopt") || q.includes("ratio") || q.includes("code"))) {
    return { type: "ai_adoption", params: { month: ctx.currentMonth } };
  }

  // Rankings / top performers
  if (q.includes("top") || q.includes("best") || q.includes("highest") || q.includes("leader") || q.includes("rank")) {
    if (q.includes("ticket") || q.includes("on-call") || q.includes("oncall") || q.includes("support")) {
      return { type: "rankings", params: { metric: "ticketsResolved", month: ctx.currentMonth } };
    }
    if (q.includes("bug")) {
      return { type: "rankings", params: { metric: "prodBugs", month: ctx.currentMonth } };
    }
    if (q.includes("ai")) {
      return { type: "rankings", params: { metric: "aiCodeRatio", month: ctx.currentMonth } };
    }
    if (q.includes("sla")) {
      return { type: "rankings", params: { metric: "slaCompliancePct", month: ctx.currentMonth } };
    }
    return { type: "rankings", params: { metric: "weightedTasks", month: ctx.currentMonth } };
  }

  // Bottom / worst / improve
  if (q.includes("worst") || q.includes("lowest") || q.includes("improve") || q.includes("struggling") || q.includes("needs attention") || q.includes("behind")) {
    if (q.includes("ai")) {
      return { type: "rankings_bottom", params: { metric: "aiCodeRatio", month: ctx.currentMonth } };
    }
    if (q.includes("sla")) {
      return { type: "rankings_bottom", params: { metric: "slaCompliancePct", month: ctx.currentMonth } };
    }
    return { type: "rankings_bottom", params: { metric: "weightedTasks", month: ctx.currentMonth } };
  }

  // On-call / heroes
  if (q.includes("on-call") || q.includes("oncall") || q.includes("hero") || q.includes("support") || q.includes("yshub")) {
    return { type: "oncall_highlights", params: { month: ctx.currentMonth } };
  }

  // Awards / highlights
  if (q.includes("award") || q.includes("highlight") || q.includes("insight") || q.includes("standout")) {
    return { type: "awards", params: { month: ctx.currentMonth } };
  }

  // SLA
  if (q.includes("sla")) {
    return { type: "sla_detail", params: { month: ctx.currentMonth } };
  }

  // Team summary / overview
  if (q.includes("team") || q.includes("overview") || q.includes("summary") || q.includes("how did") || q.includes("this month") || q.includes("kpi")) {
    return { type: "team_summary", params: { month: ctx.currentMonth } };
  }

  // Fallback
  return { type: "unknown", params: {} };
}

// ── Response generators ──

function generateResponse(intent: ParsedIntent, ctx: QueryContext): string {
  const { data, currentMonth } = ctx;

  switch (intent.type) {
    case "team_summary":
      return teamSummaryResponse(data, intent.params.month || currentMonth);
    case "developer_detail":
      return developerDetailResponse(data, intent.params.developer, currentMonth);
    case "compare_months":
      return compareMonthsResponse(data, intent.params.month_a, intent.params.month_b);
    case "squad_breakdown":
      return squadBreakdownResponse(data, intent.params.month || currentMonth);
    case "rankings":
      return rankingsResponse(data, intent.params.metric as keyof DeveloperMonthly, intent.params.month || currentMonth, "desc");
    case "rankings_bottom":
      return rankingsResponse(data, intent.params.metric as keyof DeveloperMonthly, intent.params.month || currentMonth, "asc");
    case "bugs_detail":
      return bugsDetailResponse(data, intent.params.month || currentMonth);
    case "bug_free":
      return bugFreeResponse(data, intent.params.month || currentMonth);
    case "ai_adoption":
      return aiAdoptionResponse(data, intent.params.month || currentMonth);
    case "oncall_highlights":
      return oncallHighlightsResponse(data, intent.params.month || currentMonth);
    case "awards":
      return awardsResponse(data, intent.params.month || currentMonth);
    case "sla_detail":
      return slaDetailResponse(data, intent.params.month || currentMonth);
    case "unknown":
    default:
      return unknownResponse();
  }
}

// ── Formatters (no tables — card/bullet style) ──

function kv(label: string, value: string | number, suffix = ""): string {
  return `**${label}:** ${value}${suffix}`;
}

function teamSummaryResponse(data: PerformanceData, month: string): string {
  const team = data.teamMetrics.find(t => t.month === month);
  if (!team) return `No data available for ${fmtMonth(month)}.`;

  const lines = [
    `### Team Summary — ${fmtMonth(month)}`,
    "",
    kv("DEM Tasks", team.tasksCompleted),
    kv("Tasks/Developer", team.tasksPerDeveloper),
    kv("On-Time Delivery", team.onTimeDeliveryPct, "%"),
    kv("PROD Bugs", team.prodBugs),
    kv("SBX Bugs", team.sbxBugs),
    kv("On-Call Tickets", team.ticketsResolved),
    kv("SLA Compliance", team.slaCompliancePct, "%"),
    kv("Team AI Ratio", team.teamAiRatio, "%"),
    kv("Active Devs", team.activeDevelopers),
  ];

  const months = getAvailableMonths({ data, currentMonth: month });
  const idx = months.indexOf(month);
  if (idx > 0) {
    const prev = data.teamMetrics.find(t => t.month === months[idx - 1]);
    if (prev) {
      lines.push("", `**vs ${fmtMonth(prev.month)}:**`);
      lines.push(deltaLine("Tasks", team.tasksCompleted, prev.tasksCompleted));
      lines.push(deltaLine("OTD", team.onTimeDeliveryPct, prev.onTimeDeliveryPct, "%"));
      lines.push(deltaLine("PROD Bugs", team.prodBugs, prev.prodBugs, "", true));
      lines.push(deltaLine("SLA", team.slaCompliancePct, prev.slaCompliancePct, "%"));
      lines.push(deltaLine("AI Ratio", team.teamAiRatio, prev.teamAiRatio, "%"));
    }
  }

  return lines.join("\n");
}

function developerDetailResponse(data: PerformanceData, name: string, month: string): string {
  const devs = findDeveloper(data.developerMetrics, name).filter(d => d.month === month);
  if (devs.length === 0) {
    const allMatches = findDeveloper(data.developerMetrics, name);
    if (allMatches.length === 0) return `I couldn't find a developer matching "${name}".`;
    return developerCard(allMatches[allMatches.length - 1]);
  }
  return developerCard(devs[0]);
}

function developerCard(d: DeveloperMonthly): string {
  const isDedicatedOncall = d.group === "dedicated-oncall";
  const lines = [
    `### ${d.developer}`,
    `${fmtSquad(d.group)}${d.role ? ` · ${d.role}` : ""} — ${fmtMonth(d.month)}`,
    "",
  ];

  if (isDedicatedOncall) {
    lines.push(
      kv("On-Call Tickets", d.ticketsResolved),
      kv("SLA Compliance", d.slaCompliancePct, "%"),
      kv("Median Resolution", d.medianResolutionHrs > 0 ? `${(d.medianResolutionHrs / 24).toFixed(1)}d (${Math.round(d.medianResolutionHrs)}h)` : "N/A"),
      kv("Weighted Tasks", d.weightedTasks),
      kv("AI Code Ratio", d.aiCodeRatio, "%"),
    );
  } else {
    lines.push(
      kv("DEM Tasks", d.tasksCompleted),
      kv("Weighted Tasks", d.weightedTasks),
      kv("On-Time Delivery", d.onTimeDeliveryPct, "%"),
      kv("PROD Bugs", d.prodBugs),
      kv("SBX Bugs", d.sbxBugs),
      kv("AI Code Ratio", d.aiCodeRatio, "%"),
    );
    if (d.ticketsResolved > 0) {
      lines.push(
        kv("On-Call Tickets", `${d.ticketsResolved} (helping hand)`),
        kv("SLA", d.slaCompliancePct, "%"),
      );
    }
  }

  if (d.integrations.length > 0) {
    lines.push("", "**DEM Tickets:**");
    for (const t of d.integrations) {
      lines.push(`- ${t.key} — ${t.summary} (WT ${t.weightedTasks}${t.onTime ? ", on-time" : ""})`);
    }
  }

  if (d.bugs.length > 0) {
    lines.push("", "**Bugs:**");
    for (const b of d.bugs) {
      lines.push(`- ${b.key} — ${b.summary} (${b.env})`);
    }
  }

  return lines.join("\n");
}

function compareMonthsResponse(data: PerformanceData, monthA: string, monthB: string): string {
  const a = data.teamMetrics.find(t => t.month === monthA);
  const b = data.teamMetrics.find(t => t.month === monthB);
  if (!a || !b) return `Missing data for one or both months (${fmtMonth(monthA)}, ${fmtMonth(monthB)}).`;

  const lines = [
    `### ${fmtMonth(monthA)} vs ${fmtMonth(monthB)}`,
    "",
  ];

  const metrics: { label: string; key: keyof MonthlyTeamMetrics; suffix?: string; lowerBetter?: boolean }[] = [
    { label: "DEM Tasks", key: "tasksCompleted" },
    { label: "Tasks/Dev", key: "tasksPerDeveloper" },
    { label: "OTD", key: "onTimeDeliveryPct", suffix: "%" },
    { label: "PROD Bugs", key: "prodBugs", lowerBetter: true },
    { label: "SBX Bugs", key: "sbxBugs", lowerBetter: true },
    { label: "Tickets Resolved", key: "ticketsResolved" },
    { label: "SLA", key: "slaCompliancePct", suffix: "%" },
    { label: "AI Ratio", key: "teamAiRatio", suffix: "%" },
  ];

  for (const m of metrics) {
    const va = a[m.key] as number;
    const vb = b[m.key] as number;
    const s = m.suffix || "";
    const diff = +(vb - va).toFixed(1);
    let change = "";
    if (diff !== 0) {
      const good = m.lowerBetter ? diff < 0 : diff > 0;
      change = good ? ` (+${Math.abs(diff)}${s})` : ` (${diff > 0 ? "+" : ""}${diff}${s})`;
    }
    lines.push(`**${m.label}:** ${va}${s} → ${vb}${s}${change}`);
  }

  return lines.join("\n");
}

function squadBreakdownResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  if (devs.length === 0) return `No data for ${fmtMonth(month)}.`;

  const squads = new Map<string, DeveloperMonthly[]>();
  for (const d of devs) {
    if (!squads.has(d.group)) squads.set(d.group, []);
    squads.get(d.group)!.push(d);
  }

  const lines = [`### Squad Breakdown — ${fmtMonth(month)}`, ""];

  for (const [squad, members] of squads) {
    const n = members.length;
    const tasks = sumField(members, "tasksCompleted");
    const wt = sumField(members, "weightedTasks");
    const otd = avgField(members, "onTimeDeliveryPct");
    const bugs = members.reduce((s, d) => s + d.prodBugs + d.sbxBugs, 0);
    const tickets = sumField(members, "ticketsResolved");
    const sla = avgField(members, "slaCompliancePct");
    const ai = avgField(members, "aiCodeRatio");
    const top = [...members].sort((a, b) => b.weightedTasks - a.weightedTasks)[0];

    lines.push(
      `**${fmtSquad(squad)}** (${n} devs)`,
      `Tasks: ${tasks} · WT: ${wt} · OTD: ${otd}%`,
      `Bugs: ${bugs} · Tickets: ${tickets} · SLA: ${sla}%`,
      `AI: ${ai}% · Top: ${top.developer} (WT ${top.weightedTasks})`,
      "",
    );
  }

  return lines.join("\n");
}

function rankingsResponse(data: PerformanceData, metric: keyof DeveloperMonthly, month: string, order: "asc" | "desc"): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  if (devs.length === 0) return `No data for ${fmtMonth(month)}.`;

  const sorted = [...devs].sort((a, b) => {
    const va = a[metric] as number;
    const vb = b[metric] as number;
    return order === "desc" ? vb - va : va - vb;
  });

  const label = metricLabel(metric);
  const title = order === "desc" ? `Top by ${label}` : `Needs Improvement — ${label}`;
  const top = sorted.slice(0, 10).filter(d => order === "asc" || (d[metric] as number) > 0);

  const lines = [`### ${title} — ${fmtMonth(month)}`, ""];

  for (let i = 0; i < top.length; i++) {
    const d = top[i];
    const val = d[metric] as number;
    const squad = fmtSquad(d.group);
    lines.push(`**${i + 1}. ${d.developer}** — ${fmtMetricValue(metric, val)} *(${squad})*`);
  }

  return lines.join("\n");
}

function bugsDetailResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month && d.bugs.length > 0);
  if (devs.length === 0) return `No bugs reported for ${fmtMonth(month)}.`;

  const allBugs = devs.flatMap(d => d.bugs.map(b => ({ ...b, developer: d.developer })));
  const prod = allBugs.filter(b => b.env === "PROD");
  const sbx = allBugs.filter(b => b.env === "SBX");

  const lines = [
    `### Bug Breakdown — ${fmtMonth(month)}`,
    `**${prod.length}** PROD · **${sbx.length}** SBX · **${devs.length}** developers`,
    "",
  ];

  if (prod.length > 0) {
    lines.push("**PROD Bugs:**");
    const byDev = groupBy(prod, "developer");
    for (const [dev, bugs] of Object.entries(byDev)) {
      lines.push(`\n**${dev}** (${bugs.length}):`);
      for (const b of bugs) {
        lines.push(`- ${b.key} — ${b.summary} (${b.env})${b.provider && b.provider !== "Unknown" ? ` · ${b.provider}` : ""}`);
      }
    }
  }

  if (sbx.length > 0) {
    lines.push("", "**SBX Bugs:**");
    const byDev = groupBy(sbx, "developer");
    for (const [dev, bugs] of Object.entries(byDev)) {
      lines.push(`\n**${dev}** (${bugs.length}):`);
      for (const b of bugs) {
        lines.push(`- ${b.key} — ${b.summary}`);
      }
    }
  }

  return lines.join("\n");
}

function bugFreeResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  const bugFree = getBugFreeDevs(devs);
  if (bugFree.length === 0) return `No bug-free developers in ${fmtMonth(month)} (among those with completed tasks).`;

  return [
    `### Zero-Bug Delivery — ${fmtMonth(month)}`,
    `**${bugFree.length}** developers shipped with 0 bugs:`,
    "",
    ...bugFree.map(name => `- **${name}**`),
  ].join("\n");
}

function aiAdoptionResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  const { topAdopter, belowThreshold } = getAiAdoptionCategories(devs);
  const sorted = [...devs].filter(d => d.group !== "dedicated-oncall").sort((a, b) => b.aiCodeRatio - a.aiCodeRatio);
  const teamAvg = sorted.length > 0 ? +(sorted.reduce((s, d) => s + d.aiCodeRatio, 0) / sorted.length).toFixed(1) : 0;

  const lines = [
    `### AI Adoption — ${fmtMonth(month)}`,
    "",
  ];

  if (topAdopter) lines.push(`**Top Adopter:** ${topAdopter.developer} at **${topAdopter.aiCodeRatio}%**`);
  lines.push(`**Team Average:** ${teamAvg}%`, "");

  for (const d of sorted) {
    const bar = d.aiCodeRatio >= 40 ? "+" : "-";
    const flag = d.aiCodeRatio < 40 ? " *(below 40%)*" : "";
    lines.push(`${bar} **${d.developer}** — ${d.aiCodeRatio}%${flag}`);
  }

  if (belowThreshold.length > 0) {
    lines.push("", `**${belowThreshold.length} below 40% target:** ${belowThreshold.map(d => d.developer).join(", ")}`);
  }

  return lines.join("\n");
}

function oncallHighlightsResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  const heroes = computeOnCallHeroes(devs);
  const helping = computeHelpingHand(devs);

  const lines = [`### On-Call Highlights — ${fmtMonth(month)}`, ""];

  if (!heroes) {
    lines.push("No on-call data for this period.");
    return lines.join("\n");
  }

  if (heroes.ticketMachine) {
    const h = heroes.ticketMachine;
    lines.push(`**Ticket Machine:** ${h.developer}`, `${h.ticketsResolved} tickets · ${h.slaCompliancePct}% SLA`, "");
  }
  if (heroes.fastestResolution) {
    const h = heroes.fastestResolution;
    lines.push(`**Fastest Resolution:** ${h.developer}`, `${(h.medianResolutionHrs / 24).toFixed(1)}d median resolution`, "");
  }
  if (heroes.slaChampion) {
    const h = heroes.slaChampion;
    lines.push(`**SLA Champion:** ${h.developer}`, `${h.slaCompliancePct}% SLA on ${h.ticketsResolved} tickets`, "");
  }
  if (helping) {
    lines.push(`**Helping Hand:** ${helping.developer}`, `${helping.ticketsResolved} tickets as rotating dev`, "");
  }

  const oncallDevs = devs.filter(d => d.group === "dedicated-oncall" && d.ticketsResolved > 0);
  if (oncallDevs.length > 0) {
    lines.push("**Full On-Call Team:**");
    for (const d of [...oncallDevs].sort((a, b) => b.ticketsResolved - a.ticketsResolved)) {
      const res = d.medianResolutionHrs > 0 ? ` · ${(d.medianResolutionHrs / 24).toFixed(1)}d res.` : "";
      lines.push(`- **${d.developer}** — ${d.ticketsResolved} tickets · ${d.slaCompliancePct}% SLA${res}`);
    }
  }

  return lines.join("\n");
}

function awardsResponse(data: PerformanceData, month: string): string {
  const devs = data.developerMetrics.filter(d => d.month === month);
  const speed = computeSpeedAwards(devs);
  const heroes = computeOnCallHeroes(devs);
  const helping = computeHelpingHand(devs);
  const { topAdopter } = getAiAdoptionCategories(devs);
  const bugFree = getBugFreeDevs(devs);

  const lines = [`### Awards — ${fmtMonth(month)}`, "", "**Integration:**"];

  if (speed.highestOutput) lines.push(`- Highest Output: **${speed.highestOutput.developer}** — WT ${speed.highestOutput.weightedTasks} from ${speed.highestOutput.tasksCompleted} tasks`);
  if (speed.mostTimely) lines.push(`- Most Timely: **${speed.mostTimely.developer}** — ${speed.mostTimely.onTimeDeliveryPct}% OTD`);
  if (topAdopter) lines.push(`- Top AI Adopter: **${topAdopter.developer}** — ${topAdopter.aiCodeRatio}%`);
  if (bugFree.length > 0) lines.push(`- Zero-Bug: ${bugFree.slice(0, 5).map(n => `**${n}**`).join(", ")}${bugFree.length > 5 ? ` +${bugFree.length - 5} more` : ""}`);

  lines.push("", "**On-Call:**");
  if (heroes?.ticketMachine) lines.push(`- Ticket Machine: **${heroes.ticketMachine.developer}** — ${heroes.ticketMachine.ticketsResolved} tickets`);
  if (heroes?.fastestResolution) lines.push(`- Fastest Resolution: **${heroes.fastestResolution.developer}** — ${(heroes.fastestResolution.medianResolutionHrs / 24).toFixed(1)}d`);
  if (heroes?.slaChampion) lines.push(`- SLA Champion: **${heroes.slaChampion.developer}** — ${heroes.slaChampion.slaCompliancePct}%`);
  if (helping) lines.push(`- Helping Hand: **${helping.developer}** — ${helping.ticketsResolved} tickets`);

  return lines.join("\n");
}

function slaDetailResponse(data: PerformanceData, month: string): string {
  const priority = data.onCallPriority.filter(p => p.month === month);
  const devs = data.developerMetrics.filter(d => d.month === month && d.ticketsResolved > 0);

  const lines = [`### SLA Detail — ${fmtMonth(month)}`, ""];

  if (priority.length > 0) {
    lines.push("**By Priority:**");
    for (const p of priority) {
      const res = p.medianResolutionHrs > 0 ? ` · ${(p.medianResolutionHrs / 24).toFixed(1)}d median` : "";
      lines.push(`- **${p.priority}** — ${p.slaCompliancePct}% SLA${res}`);
    }
    lines.push("");
  }

  if (devs.length > 0) {
    lines.push("**By Developer:**");
    for (const d of [...devs].sort((a, b) => b.slaCompliancePct - a.slaCompliancePct)) {
      const res = d.medianResolutionHrs > 0 ? ` · ${(d.medianResolutionHrs / 24).toFixed(1)}d res.` : "";
      lines.push(`- **${d.developer}** — ${d.slaCompliancePct}% on ${d.ticketsResolved} tickets${res}`);
    }
  }

  return lines.join("\n");
}

function unknownResponse(): string {
  return [
    "I can help with these questions:",
    "",
    "- **\"How did the team do?\"** — team KPIs",
    "- **\"How did [name] do?\"** — developer detail",
    "- **\"Compare Jan vs Feb\"** — month comparison",
    "- **\"Compare squads\"** — squad breakdown",
    "- **\"Top performers\"** — rankings",
    "- **\"Bug breakdown\"** — bug details",
    "- **\"AI adoption\"** — AI code ratios",
    "- **\"On-call highlights\"** — support heroes",
    "- **\"SLA detail\"** — SLA by priority/dev",
    "- **\"Who needs to improve?\"** — bottom list",
    "",
    "Try one of these!",
  ].join("\n");
}

// ── Helpers ──

function findDeveloper(devs: DeveloperMonthly[], name: string): DeveloperMonthly[] {
  const lower = name.toLowerCase();
  return devs.filter(d => d.developer.toLowerCase().includes(lower));
}

function findDeveloperInQuery(query: string, ctx: QueryContext): string | null {
  const uniqueNames = [...new Set(ctx.data.developerMetrics.map(d => d.developer))];
  for (const name of uniqueNames) {
    if (query.includes(name.toLowerCase())) return name;
  }
  for (const name of uniqueNames) {
    const firstName = name.split(" ")[0].toLowerCase();
    if (firstName.length > 3 && query.includes(firstName)) return name;
  }
  for (const name of uniqueNames) {
    const parts = name.split(" ");
    const lastName = parts[parts.length - 1].toLowerCase();
    if (lastName.length > 3 && query.includes(lastName)) return name;
  }
  const howDidMatch = query.match(/how (?:did|is|was) (\w+(?:\s+\w+)?)\s+(?:do|doing|perform)/);
  if (howDidMatch) {
    const searchName = howDidMatch[1].toLowerCase();
    for (const name of uniqueNames) {
      if (name.toLowerCase().includes(searchName)) return name;
    }
  }
  return null;
}

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function resolveMonthName(name: string, ctx: QueryContext): string {
  const key = name.toLowerCase().slice(0, 3);
  const num = MONTH_MAP[key] || "01";
  const year = ctx.currentMonth.split("-")[0] || "2026";
  return `${year}-${num}`;
}

function getAvailableMonths(ctx: QueryContext): string[] {
  return [...new Set(ctx.data.teamMetrics.map(t => t.month))].sort();
}

function fmtMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${year}`;
}

function fmtSquad(squad: string): string {
  const map: Record<string, string> = {
    "the-hallows": "The Hallows",
    "mortifagos": "Mortifagos",
    "dementors": "Dementors",
    "dedicated-oncall": "Dedicated On-Call",
  };
  return map[squad] || squad;
}

function metricLabel(metric: keyof DeveloperMonthly): string {
  const map: Record<string, string> = {
    tasksCompleted: "DEM Tasks",
    weightedTasks: "Weighted Tasks",
    onTimeDeliveryPct: "OTD %",
    prodBugs: "PROD Bugs",
    sbxBugs: "SBX Bugs",
    aiCodeRatio: "AI %",
    ticketsResolved: "Tickets",
    slaCompliancePct: "SLA %",
    medianResolutionHrs: "Resolution",
  };
  return map[metric as string] || String(metric);
}

function fmtMetricValue(metric: keyof DeveloperMonthly, val: number): string {
  if (String(metric).includes("Pct") || metric === "aiCodeRatio") return `${val}%`;
  if (metric === "medianResolutionHrs") return val > 0 ? `${(val / 24).toFixed(1)}d` : "-";
  return String(val);
}

function deltaLine(label: string, current: number, previous: number, suffix = "", lowerIsBetter = false): string {
  const diff = +(current - previous).toFixed(1);
  if (diff === 0) return `- ${label}: ${current}${suffix} (unchanged)`;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const arrow = good ? "+" : "";
  return `- ${label}: ${current}${suffix} (${arrow}${diff}${suffix})`;
}

function sumField(devs: DeveloperMonthly[], field: keyof DeveloperMonthly): number {
  return devs.reduce((s, d) => s + (d[field] as number), 0);
}

function avgField(devs: DeveloperMonthly[], field: keyof DeveloperMonthly): number {
  if (devs.length === 0) return 0;
  return +(devs.reduce((s, d) => s + (d[field] as number), 0) / devs.length).toFixed(1);
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

// ── Main export ──

export function processMessage(input: string, data: PerformanceData, currentMonth: string): string {
  const ctx: QueryContext = { data, currentMonth };
  const intent = parseIntent(input, ctx);
  return generateResponse(intent, ctx);
}
