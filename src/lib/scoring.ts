import { DeveloperMonthly } from "./types";

export function getTopByField(
  devs: DeveloperMonthly[],
  field: keyof DeveloperMonthly,
  order: "asc" | "desc" = "desc"
): DeveloperMonthly | undefined {
  const sorted = [...devs].sort((a, b) => {
    const aVal = a[field] as number;
    const bVal = b[field] as number;
    return order === "desc" ? bVal - aVal : aVal - bVal;
  });
  return sorted[0];
}

export function getBottomByField(
  devs: DeveloperMonthly[],
  field: keyof DeveloperMonthly,
  order: "asc" | "desc" = "desc"
): DeveloperMonthly | undefined {
  const sorted = [...devs].sort((a, b) => {
    const aVal = a[field] as number;
    const bVal = b[field] as number;
    return order === "desc" ? bVal - aVal : aVal - bVal;
  });
  return sorted[sorted.length - 1];
}

export function getBugFreeDevs(devs: DeveloperMonthly[]): string[] {
  // Only integration devs (exclude dedicated on-call)
  return devs
    .filter(d => d.group !== "dedicated-oncall" && d.prodBugs === 0 && d.sbxBugs === 0 && d.tasksCompleted > 0)
    .map(d => d.developer);
}

export function computeSpeedAwards(devs: DeveloperMonthly[]) {
  // Only integration devs (exclude dedicated on-call)
  const integrationDevs = devs.filter(d => d.group !== "dedicated-oncall");
  const withTasks = integrationDevs.filter(d => d.tasksCompleted > 0);
  const highestOutput = getTopByField(withTasks, "weightedTasks", "desc");
  const mostTimely = getTopByField(withTasks, "onTimeDeliveryPct", "desc");

  const sorted = [...withTasks].sort((a, b) => {
    const scoreA = a.onTimeDeliveryPct * (a.weightedTasks / 10);
    const scoreB = b.onTimeDeliveryPct * (b.weightedTasks / 10);
    return scoreB - scoreA;
  });
  const toughestOtd = sorted.find(d => d !== highestOutput && d !== mostTimely) ?? sorted[0];

  const roomToGrow = getBottomByField(withTasks, "weightedTasks", "desc");

  return { highestOutput, mostTimely, toughestOtd, roomToGrow };
}

export function computeOnCallHeroes(devs: DeveloperMonthly[]) {
  // Only dedicated on-call for main heroes
  const dedicatedOncall = devs.filter(d => d.group === "dedicated-oncall" && d.ticketsResolved > 0);
  if (dedicatedOncall.length === 0) return null;

  const ticketMachine = getTopByField(dedicatedOncall, "ticketsResolved", "desc");
  const withResolution = dedicatedOncall.filter(d => d.medianResolutionHrs > 0);
  const fastestResolution = getTopByField(withResolution, "medianResolutionHrs", "asc");
  const withSla = dedicatedOncall.filter(d => d.slaCompliancePct > 0);
  const slaChampion = getTopByField(withSla, "slaCompliancePct", "desc");

  return { ticketMachine, fastestResolution, slaChampion };
}

// Helping Hand: rotating dev (not dedicated-oncall) with most YSHUB tickets
export function computeHelpingHand(devs: DeveloperMonthly[]): DeveloperMonthly | undefined {
  return [...devs]
    .filter(d => d.group !== "dedicated-oncall" && d.ticketsResolved > 0)
    .sort((a, b) => b.ticketsResolved - a.ticketsResolved)[0];
}
