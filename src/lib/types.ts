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
}

export interface BugTicket {
  key: string;
  summary: string;
  env: "PROD" | "SBX" | "STG";
  provider: string;   // from Jira "Providers" field (customfield_10229)
  source: "DEM" | "YSHUB"; // which project this bug came from
  month?: string;      // "2026-02" — set when aggregated across months
}

export interface OnCallTicket {
  key: string;       // e.g. "YSHUB-1234"
  summary: string;
  priority: string;
  slaBreached: boolean;
  resolutionHrs: number | null;
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
  developers: Developer[];
  yshubBugs: BugTicket[];
}

export type GroupFilter = "all" | Squad;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
