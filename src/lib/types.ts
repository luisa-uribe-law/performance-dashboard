export type Squad = "the-hallows" | "mortifagos" | "dementors" | "dedicated-oncall";

export interface Developer {
  name: string;
  group: Squad;
}

export interface MonthlyTeamMetrics {
  month: string; // "2026-01", "2026-02", etc.
  tasksCompleted: number;
  tasksPerDeveloper: number;
  onTimeDeliveryPct: number;
  prodBugs: number;
  sbxBugs: number;
  // YSHUB Bug-type issues by reporting type (for chart breakdown)
  yshubBugsMerchant: number;
  yshubBugsTeam: number;
  yshubBugsUnknown: number;
  ticketsResolved: number;
  slaCompliancePct: number;
  medianResolutionDays: number;
  activeDevelopers: number;
}

export interface IntegrationTicket {
  key: string;       // e.g. "DEM-1234"
  summary: string;
  weightedTasks: number;
  onTime: boolean;
  closedDate: string | null; // ISO date e.g. "2026-02-15"
}

export interface BugTicket {
  key: string;
  summary: string;
  env: "PROD" | "SBX" | "STG";
  provider: string;   // from Jira "Providers" field (customfield_10229)
  source: "DEM" | "YSHUB"; // which project this bug came from
  reportingType: "Merchant" | "Team" | "Unknown"; // from Jira "Reporting Type" (customfield_11877)
  month?: string;      // "2026-02" — set when aggregated across months
}

export interface OnCallTicket {
  key: string;       // e.g. "YSHUB-1234"
  summary: string;
  priority: string;
  slaBreached: boolean;
  resolutionHrs: number | null;
  closedDate: string | null; // ISO date e.g. "2026-02-15"
}

export interface DeveloperMonthly {
  developer: string;
  month: string;
  group: Squad;
  role?: string;
  deactivated?: boolean; // true if developer has since left the team
  // DEM metrics
  tasksCompleted: number;
  weightedTasks: number;
  onTimeDeliveryPct: number;
  prodBugs: number;
  sbxBugs: number;
  // On-call
  ticketsResolved: number;
  medianResolutionHrs: number;
  slaCompliancePct: number;
  // Detail lists
  integrations: IntegrationTicket[];
  bugs: BugTicket[];
  onCallTickets: OnCallTicket[];
}

export type PriorityLabel = "Highest" | "High" | "Medium" | "Low";

export interface OnCallPriorityMetrics {
  month: string;
  priority: PriorityLabel;
  medianResolutionHrs: number;
  slaCompliancePct: number;
}

export interface BugSlaPriorityMetrics {
  month: string;
  priority: PriorityLabel;
  count: number;
  slaCompliancePct: number;
  medianResolutionHrs: number;
}

export interface BugSlaMetrics {
  month: string;
  totalBugs: number;
  overallSlaPct: number;
  medianResolutionHrs: number;
  byPriority: BugSlaPriorityMetrics[];
}

export interface AwardCard {
  title: string;
  subtitle: string;
  developer: string;
  value: string;
  icon: string;
}

export interface PerformanceData {
  teamMetrics: MonthlyTeamMetrics[];
  developerMetrics: DeveloperMonthly[];
  onCallPriority: OnCallPriorityMetrics[];
  bugSla: BugSlaMetrics[];
  developers: Developer[];
  yshubBugs: BugTicket[];
}

export type GroupFilter = "all" | Squad;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
