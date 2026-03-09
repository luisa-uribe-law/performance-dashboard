import { PerformanceData, Developer, MonthlyTeamMetrics, DeveloperMonthly, OnCallPriorityMetrics, IntegrationTicket, BugTicket, Squad } from "./types";

// ── Real developer roster ──
const developers: Developer[] = [
  // Squad Alpha
  { name: "Juan Quintana", group: "the-hallows" },
  { name: "Juan David Canal Vera", group: "the-hallows" },
  { name: "Neller Pellegrino", group: "the-hallows" },
  { name: "Garvit Gupta", group: "the-hallows" },
  // Squad Beta
  { name: "Andres Salazar", group: "mortifagos" },
  { name: "Daniel Betancurth", group: "mortifagos" },
  { name: "Daniela Perea", group: "mortifagos" },
  { name: "Nicolas Carolo", group: "mortifagos" },
  { name: "Ever Daniel Rivera", group: "mortifagos" },
  // Squad Gamma
  { name: "Martin Sandroni", group: "dementors" },
  { name: "Marcos Sputnick", group: "dementors" },
  { name: "Sudheer Puppala", group: "dementors" },
  { name: "Denys Rosario", group: "dementors" },
  // Fixed On-Call
  { name: "Vivek Rajpara", group: "dedicated-oncall" },
  { name: "Daniel Hernandez", group: "dedicated-oncall" },
  { name: "Emmanuel Rocha", group: "dedicated-oncall" },
  { name: "Diego Leon", group: "dedicated-oncall" },
];

// ── Real team metrics (Jan + Feb only) ──
const teamMetrics: MonthlyTeamMetrics[] = [
  {
    month: "2026-01",
    tasksCompleted: 12, tasksPerDeveloper: 1.5, onTimeDeliveryPct: 36,
    prodBugs: 10, sbxBugs: 5,
    ticketsResolved: 193, slaCompliancePct: 66.4,
    teamAiRatio: 42, medianResolutionDays: 4.8,
    activeDevelopers: 18,
  },
  {
    month: "2026-02",
    tasksCompleted: 19, tasksPerDeveloper: 1.5, onTimeDeliveryPct: 63,
    prodBugs: 7, sbxBugs: 4,
    ticketsResolved: 230, slaCompliancePct: 75.0,
    teamAiRatio: 52, medianResolutionDays: 5.0,
    activeDevelopers: 20,
  },
];

// ── On-Call Priority (Jan + Feb only) ──
const onCallPriority: OnCallPriorityMetrics[] = [
  { month: "2026-01", priority: "Highest", medianResolutionHrs: 163.0, slaCompliancePct: 60 },
  { month: "2026-01", priority: "High",    medianResolutionHrs: 105.6, slaCompliancePct: 63 },
  { month: "2026-01", priority: "Medium",  medianResolutionHrs: 115.3, slaCompliancePct: 58 },
  { month: "2026-01", priority: "Low",     medianResolutionHrs: 87.4,  slaCompliancePct: 68 },
  { month: "2026-02", priority: "Highest", medianResolutionHrs: 184.1, slaCompliancePct: 65 },
  { month: "2026-02", priority: "High",    medianResolutionHrs: 118.0, slaCompliancePct: 72 },
  { month: "2026-02", priority: "Medium",  medianResolutionHrs: 144.9, slaCompliancePct: 68 },
  { month: "2026-02", priority: "Low",     medianResolutionHrs: 78.5,  slaCompliancePct: 80 },
];

// ── Integration ticket data (Feb, real tasks) ──
const realIntegrations: Record<string, IntegrationTicket[]> = {
  "Juan Quintana": [
    { key: "DEM-4521", summary: "[TAP] Cards — PURCHASE flow", weightedTasks: 2, onTime: true },
    { key: "DEM-4530", summary: "[BeyondOne] Apple/Google Pay for TAP", weightedTasks: 3, onTime: true },
    { key: "DEM-4545", summary: "[Moon Active] Dynamic metadata — CheckOut.com", weightedTasks: 2, onTime: false },
    { key: "DEM-4552", summary: "[IPSP-SBP] PURCHASE + REFUND integration", weightedTasks: 3, onTime: true },
    { key: "DEM-4560", summary: "[Moon Active] Currency mapping — CheckOut.com", weightedTasks: 1, onTime: false },
    { key: "DEM-4565", summary: "[BeyondOne] TAP tokenization update", weightedTasks: 2, onTime: true },
  ],
  "Juan David Canal Vera": [
    { key: "DEM-4580", summary: "[Global] Portuguese translations — all providers", weightedTasks: 2, onTime: true },
    { key: "DEM-4590", summary: "[PROSA] Multi-MS architecture — CARD flow", weightedTasks: 3, onTime: true },
    { key: "DEM-4595", summary: "[PROSA] Flag modification — routing rules", weightedTasks: 2, onTime: true },
  ],
  "Neller Pellegrino": [
    { key: "DEM-4700", summary: "[Wompi] PSE — PURCHASE flow", weightedTasks: 3, onTime: true },
    { key: "DEM-4710", summary: "[PagSeguro] BOLETO — status mapping", weightedTasks: 2, onTime: false },
  ],
  "Garvit Gupta": [
    { key: "DEM-4680", summary: "[CyberSource] 3DS — verification flow", weightedTasks: 2, onTime: true },
    { key: "DEM-4685", summary: "[Worldpay] CARD — PURCHASE flow", weightedTasks: 2, onTime: false },
    { key: "DEM-4688", summary: "[CyberSource] CARD — tokenization update", weightedTasks: 1, onTime: true },
  ],
  "Andres Salazar": [
    { key: "DEM-4650", summary: "[PayU] PSE — PURCHASE flow", weightedTasks: 2, onTime: true },
  ],
  "Vivek Rajpara": [
    { key: "DEM-4720", summary: "[Stripe] Webhook retry mechanism update", weightedTasks: 2, onTime: true },
  ],
  "Emmanuel Rocha": [
    { key: "DEM-4730", summary: "[Adyen] Error code mapping — decline reasons", weightedTasks: 2, onTime: false },
  ],
  "Diego Leon": [
    { key: "DEM-4640", summary: "[Stripe] OXXO — PURCHASE flow", weightedTasks: 2, onTime: false },
  ],
  "Marcos Sputnick": [
    { key: "DEM-4660", summary: "[dLocal] CARD — CAPTURE flow", weightedTasks: 2, onTime: false },
  ],
};

// ── Bug pool ──
const providerBugs: { summary: string; env: "PROD" | "SBX"; integration: string }[] = [
  { summary: "Null pointer on refund callback", env: "PROD", integration: "Stripe — CARD" },
  { summary: "Timeout on 3DS verification flow", env: "PROD", integration: "Adyen — CARD" },
  { summary: "Currency mismatch in settlement", env: "PROD", integration: "dLocal — CARD" },
  { summary: "Missing idempotency key on capture", env: "PROD", integration: "Stripe — CARD" },
  { summary: "Race condition on concurrent captures", env: "PROD", integration: "PayU — CARD" },
  { summary: "Incorrect status mapping AUTHORIZED→CAPTURED", env: "PROD", integration: "Nuvei — CARD" },
  { summary: "Webhook signature validation failure", env: "PROD", integration: "Adyen — CARD" },
  { summary: "Encoding issue in provider name field", env: "PROD", integration: "Conekta — OXXO" },
  { summary: "Duplicate webhook processing", env: "PROD", integration: "Stripe — WALLET" },
  { summary: "Amount precision loss on micro-payments", env: "PROD", integration: "Mercado Pago — CARD" },
  { summary: "Token expiry not handled on retry", env: "PROD", integration: "CyberSource — CARD" },
  { summary: "Missing error code mapping for decline", env: "PROD", integration: "Worldpay — CARD" },
  { summary: "PSE redirect URL malformed", env: "PROD", integration: "PayU — PSE" },
  { summary: "PIX QR code generation timeout", env: "PROD", integration: "dLocal — PIX" },
  { summary: "Refund amount exceeds original charge", env: "PROD", integration: "Kushki — CARD" },
  { summary: "3DS challenge flow drops session", env: "PROD", integration: "Adyen — CARD" },
  { summary: "Capture after void returns 200", env: "PROD", integration: "Stripe — CARD" },
  { summary: "Settlement currency conversion error", env: "PROD", integration: "dLocal — CARD" },
  { summary: "Webhook retry storm on 503", env: "PROD", integration: "PayPal — WALLET" },
  { summary: "Apple Pay domain verification failing", env: "PROD", integration: "Stripe — WALLET" },
  { summary: "Google Pay token decrypt error", env: "PROD", integration: "Adyen — WALLET" },
  { summary: "BOLETO expiry date calculation off by 1", env: "PROD", integration: "PagSeguro — BOLETO" },
  { summary: "Bank transfer status polling infinite loop", env: "PROD", integration: "Wompi — BANK_TRANSFER" },
  { summary: "Partial refund rounding error", env: "PROD", integration: "Mercado Pago — CARD" },
  { summary: "Card BIN lookup returns null country", env: "PROD", integration: "CyberSource — CARD" },
  { summary: "SBX: Test card rejected in staging", env: "SBX", integration: "Stripe — CARD" },
  { summary: "SBX: Mock webhook payload mismatch", env: "SBX", integration: "Adyen — CARD" },
  { summary: "SBX: Sandbox token not refreshing", env: "SBX", integration: "PayU — CARD" },
  { summary: "SBX: PIX QR code not rendering", env: "SBX", integration: "dLocal — PIX" },
  { summary: "SBX: OXXO voucher missing barcode", env: "SBX", integration: "Conekta — OXXO" },
  { summary: "SBX: PSE bank list returning empty", env: "SBX", integration: "PayU — PSE" },
  { summary: "SBX: BOLETO PDF generation failure", env: "SBX", integration: "PagSeguro — BOLETO" },
  { summary: "SBX: Wallet balance check timeout", env: "SBX", integration: "Mercado Pago — WALLET" },
  { summary: "SBX: 3DS simulator returning wrong version", env: "SBX", integration: "CyberSource — CARD" },
  { summary: "SBX: Crypto address validation strict mode", env: "SBX", integration: "Nuvei — CRYPTO" },
];

// ── Feb data (exact from report) ──
// DEM = integration tasks, YSHUB = on-call tickets, WT = total weighted
interface DevMonthData {
  dem: number;
  yshub: number;
  wt: number;
  otd: number;    // -1 means N/A (no DEM tasks)
  prodBugs: number;
  sbxBugs: number;
  ai: number;     // -1 means no data
  // On-call specific (for fixed on-call)
  oncallSla: number;
  oncallMedianHrs: number;
}

const febData: Record<string, DevMonthData> = {
  "Vivek Rajpara":        { dem: 1,  yshub: 44, wt: 95, otd: 100, prodBugs: 0, sbxBugs: 0, ai: 66.9, oncallSla: 86.7, oncallMedianHrs: 62.5 },
  "Daniel Hernandez":     { dem: 0,  yshub: 28, wt: 56, otd: -1,  prodBugs: 0, sbxBugs: 0, ai: 37.8, oncallSla: 71.4, oncallMedianHrs: 91.3 },
  "Emmanuel Rocha":       { dem: 1,  yshub: 23, wt: 53, otd: 0,   prodBugs: 0, sbxBugs: 1, ai: 39.1, oncallSla: 71.4, oncallMedianHrs: 49.1 },
  "Diego Leon":           { dem: 1,  yshub: 21, wt: 51, otd: 0,   prodBugs: 0, sbxBugs: 0, ai: 56.3, oncallSla: 60.0, oncallMedianHrs: 110.3 },
  "Martin Sandroni":      { dem: 0,  yshub: 13, wt: 25, otd: -1,  prodBugs: 0, sbxBugs: 1, ai: 64.4, oncallSla: 80.0, oncallMedianHrs: 72.0 },
  "Ever Daniel Rivera":   { dem: 0,  yshub: 12, wt: 16, otd: -1,  prodBugs: 0, sbxBugs: 0, ai: 38.9, oncallSla: 100.0, oncallMedianHrs: 65.0 },
  "Juan Quintana":        { dem: 6,  yshub: 4,  wt: 21, otd: 60,  prodBugs: 0, sbxBugs: 2, ai: 50.7, oncallSla: 0, oncallMedianHrs: 0 },
  "Andres Salazar":       { dem: 1,  yshub: 8,  wt: 19, otd: 100, prodBugs: 0, sbxBugs: 0, ai: 15.9, oncallSla: 0, oncallMedianHrs: 0 },
  "Juan David Canal Vera":{ dem: 3,  yshub: 5,  wt: 15, otd: 100, prodBugs: 0, sbxBugs: 0, ai: 47.3, oncallSla: 0, oncallMedianHrs: 0 },
  "Neller Pellegrino":    { dem: 2,  yshub: 5,  wt: 14, otd: 50,  prodBugs: 1, sbxBugs: 0, ai: 47.0, oncallSla: 0, oncallMedianHrs: 0 },
  "Garvit Gupta":         { dem: 3,  yshub: 3,  wt: 9,  otd: 50,  prodBugs: 0, sbxBugs: 0, ai: 40.6, oncallSla: 0, oncallMedianHrs: 0 },
  "Nicolas Carolo":       { dem: 0,  yshub: 4,  wt: 8,  otd: -1,  prodBugs: 0, sbxBugs: 0, ai: 69.1, oncallSla: 0, oncallMedianHrs: 0 },
  "Daniel Betancurth":    { dem: 0,  yshub: 4,  wt: 9,  otd: -1,  prodBugs: 2, sbxBugs: 0, ai: 51.5, oncallSla: 0, oncallMedianHrs: 0 },
  "Daniela Perea":        { dem: 0,  yshub: 2,  wt: 4,  otd: -1,  prodBugs: 2, sbxBugs: 0, ai: 85.6, oncallSla: 0, oncallMedianHrs: 0 },
  "Marcos Sputnick":      { dem: 1,  yshub: 1,  wt: 3,  otd: 0,   prodBugs: 2, sbxBugs: 0, ai: 56.4, oncallSla: 0, oncallMedianHrs: 0 },
  "Sudheer Puppala":      { dem: 0,  yshub: 0,  wt: 0,  otd: -1,  prodBugs: 0, sbxBugs: 0, ai: 56.6, oncallSla: 0, oncallMedianHrs: 0 },
  "Denys Rosario":        { dem: 0,  yshub: 0,  wt: 0,  otd: -1,  prodBugs: 0, sbxBugs: 0, ai: 0,    oncallSla: 0, oncallMedianHrs: 0 },
};

const months = ["2026-01", "2026-02"];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function assignBugs(prodCount: number, sbxCount: number): BugTicket[] {
  const prodPool = providerBugs.filter(b => b.env === "PROD");
  const sbxPool = providerBugs.filter(b => b.env === "SBX");
  const bugs: BugTicket[] = [];
  const pickedProd = pickRandom(prodPool, prodCount);
  const pickedSbx = pickRandom(sbxPool, sbxCount);
  for (const b of pickedProd) {
    bugs.push({ key: `DEM-${5000 + Math.floor(Math.random() * 5000)}`, summary: b.summary, env: "PROD", source: "DEM" as const, provider: b.integration.split(" — ")[0] || "Unknown" });
  }
  for (const b of pickedSbx) {
    bugs.push({ key: `DEM-${5000 + Math.floor(Math.random() * 5000)}`, summary: b.summary, env: "SBX", source: "DEM" as const, provider: b.integration.split(" — ")[0] || "Unknown" });
  }
  // Fill if pool too small
  while (bugs.filter(b => b.env === "PROD").length < prodCount) {
    const b = prodPool[bugs.length % prodPool.length];
    bugs.push({ key: `DEM-${5000 + Math.floor(Math.random() * 5000)}`, summary: b.summary, env: "PROD", source: "DEM" as const, provider: b.integration.split(" — ")[0] || "Unknown" });
  }
  while (bugs.filter(b => b.env === "SBX").length < sbxCount) {
    const b = sbxPool[bugs.length % sbxPool.length];
    bugs.push({ key: `DEM-${5000 + Math.floor(Math.random() * 5000)}`, summary: b.summary, env: "SBX", source: "DEM" as const, provider: b.integration.split(" — ")[0] || "Unknown" });
  }
  return bugs;
}

function buildDevMonth(name: string, month: string, group: Squad, d: DevMonthData): DeveloperMonthly {
  const integrations = realIntegrations[name] && (month === "2026-02")
    ? realIntegrations[name]
    : d.dem > 0
      ? Array.from({ length: d.dem }, (_, i) => ({
          key: `DEM-${3000 + Math.floor(Math.random() * 7000)}`,
          summary: `Integration task ${i + 1}`,
          weightedTasks: Math.max(1, Math.round(d.wt / Math.max(1, d.dem + d.yshub))),
          onTime: d.otd > 0 ? Math.random() * 100 < d.otd : false,
        }))
      : [];

  return {
    developer: name,
    month,
    group,
    tasksCompleted: d.dem,
    weightedTasks: d.wt,
    onTimeDeliveryPct: d.otd === -1 ? 0 : d.otd,
    prodBugs: d.prodBugs,
    sbxBugs: d.sbxBugs,
    aiCodeRatio: d.ai === -1 ? 0 : Math.round(d.ai * 10) / 10,
    ticketsResolved: d.yshub,
    medianResolutionHrs: d.oncallMedianHrs,
    slaCompliancePct: d.oncallSla,
    integrations,
    bugs: assignBugs(d.prodBugs, d.sbxBugs),
    onCallTickets: [],
  };
}

// Estimate earlier months by decaying from Feb values
function estimateEarlierMonth(febD: DevMonthData, monthsBack: number): DevMonthData {
  const decay = Math.max(0.3, 1 - monthsBack * 0.12);
  const noisy = (v: number, spread = 0.2) => Math.max(0, Math.round(v * decay + (Math.random() - 0.5) * v * spread));
  return {
    dem: noisy(febD.dem),
    yshub: noisy(febD.yshub),
    wt: noisy(febD.wt),
    otd: febD.otd <= 0 ? febD.otd : Math.max(0, Math.min(100, Math.round(febD.otd * decay))),
    prodBugs: Math.max(0, noisy(febD.prodBugs + 1, 0.3)),
    sbxBugs: Math.max(0, noisy(febD.sbxBugs + 1, 0.3)),
    ai: febD.ai <= 0 ? 0 : Math.max(0, Math.min(95, Math.round(febD.ai - monthsBack * 4 + (Math.random() - 0.5) * 5))),
    oncallSla: febD.oncallSla > 0 ? Math.max(0, Math.min(100, Math.round(febD.oncallSla - monthsBack * 3))) : 0,
    oncallMedianHrs: febD.oncallMedianHrs > 0 ? +(febD.oncallMedianHrs * (1 + monthsBack * 0.06) + (Math.random() - 0.5) * 8).toFixed(1) : 0,
  };
}

function generateDeveloperMetrics(): DeveloperMonthly[] {
  const results: DeveloperMonthly[] = [];

  for (const dev of developers) {
    const feb = febData[dev.name];
    if (!feb) continue;

    // Feb (exact real data)
    results.push(buildDevMonth(dev.name, "2026-02", dev.group, feb));

    // Jan (estimated ~80-90% of Feb)
    const jan = estimateEarlierMonth(feb, 1);
    results.push(buildDevMonth(dev.name, "2026-01", dev.group, jan));
  }

  return results;
}

export function getMockData(): PerformanceData {
  return {
    developers,
    teamMetrics,
    developerMetrics: generateDeveloperMetrics(),
    onCallPriority,
    yshubBugs: [],
  };
}

let cachedData: PerformanceData | null = null;
export function getStableData(): PerformanceData {
  if (!cachedData) {
    cachedData = getMockData();
  }
  return cachedData;
}
