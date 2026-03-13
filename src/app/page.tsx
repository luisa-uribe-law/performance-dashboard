"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PerformanceData, GroupFilter, DeveloperMonthly } from "@/lib/types";
import { formatMonthLong, formatMonth } from "@/lib/format";
import Header, { DateRange, DateMode } from "@/components/layout/Header";
import ChatPanel from "@/components/layout/ChatPanel";
import KpiCard from "@/components/shared/KpiCard";
import DevProfileModal from "@/components/shared/DevProfileModal";
import IntegrationBugsView from "@/components/shared/IntegrationBugsView";
import MethodologyModal from "@/components/shared/MethodologyModal";
import IntegrationPanel from "@/components/sections/IntegrationPanel";
import OnCallPanel from "@/components/sections/OnCallPanel";
import Insights from "@/components/sections/Insights";
import TeamRoster from "@/components/sections/TeamRoster";

type View = "dashboard" | "bugs";

function computeActiveMonths(dr: DateRange, allMonths: string[]): string[] {
  if (dr.mode === "month") return [dr.selectedMonth].filter(Boolean);
  if (dr.mode === "ytd") {
    const year = dr.selectedMonth.split("-")[0];
    return allMonths.filter(m => m.startsWith(year) && m <= dr.selectedMonth);
  }
  return allMonths.filter(m => m >= dr.rangeFrom && m <= dr.rangeTo);
}

export default function Dashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [group, setGroup] = useState<GroupFilter>("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  // Date range state
  const [dateMode, setDateMode] = useState<DateMode>("month");
  const [pickedMonth, setPickedMonth] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const dateRange: DateRange = { mode: dateMode, selectedMonth: pickedMonth, rangeFrom, rangeTo };

  const handleDateRangeChange = useCallback((dr: DateRange) => {
    setDateMode(dr.mode);
    setPickedMonth(dr.selectedMonth);
    setRangeFrom(dr.rangeFrom);
    setRangeTo(dr.rangeTo);
  }, []);

  useEffect(() => {
    fetch(`/api/data?group=${group}`)
      .then(r => r.json())
      .then((d: PerformanceData) => {
        setData(d);
        const ms = [...new Set(d.teamMetrics.map(m => m.month))].sort();
        setAllMonths(ms);
        // Initialize date range if not set
        setPickedMonth(prev => prev && ms.includes(prev) ? prev : ms[ms.length - 1] || "");
        setRangeFrom(prev => prev || ms[0] || "");
        setRangeTo(prev => prev || ms[ms.length - 1] || "");
      });
  }, [group]);

  // Active months based on current date range
  const activeMonths = useMemo(
    () => computeActiveMonths(dateRange, allMonths),
    [dateMode, pickedMonth, rangeFrom, rangeTo, allMonths]
  );

  // The "primary" month = the latest in active range (for charts, banner)
  const selectedMonth = activeMonths[activeMonths.length - 1] || "";
  const isMultiMonth = activeMonths.length > 1;

  // YSHUB Bug-type issues filtered by active months
  const activeBugs = useMemo(() => {
    if (!data) return [];
    const monthSet = new Set(activeMonths);
    return data.yshubBugs.filter(b => b.month && monthSet.has(b.month));
  }, [data, activeMonths]);

  // For multi-month: aggregate developer metrics across months
  const aggregatedDevs = useMemo(() => {
    if (!data) return [];
    if (!isMultiMonth) {
      return data.developerMetrics.filter(d => d.month === selectedMonth);
    }
    // Aggregate across active months
    const monthSet = new Set(activeMonths);
    const devMap = new Map<string, DeveloperMonthly>();
    for (const d of data.developerMetrics) {
      if (!monthSet.has(d.month)) continue;
      const existing = devMap.get(d.developer);
      if (!existing) {
        devMap.set(d.developer, { ...d, month: selectedMonth });
      } else {
        existing.tasksCompleted += d.tasksCompleted;
        existing.weightedTasks += d.weightedTasks;
        existing.prodBugs += d.prodBugs;
        existing.sbxBugs += d.sbxBugs;
        existing.ticketsResolved += d.ticketsResolved;
        existing.integrations = [...existing.integrations, ...d.integrations];
        existing.bugs = [...existing.bugs, ...d.bugs];
        existing.onCallTickets = [...existing.onCallTickets, ...d.onCallTickets];
        // Average percentages
        const months = activeMonths.filter(m => data.developerMetrics.some(dm => dm.developer === d.developer && dm.month === m));
        const devEntries = data.developerMetrics.filter(dm => dm.developer === d.developer && monthSet.has(dm.month));
        const otdEntries = devEntries.filter(dm => dm.tasksCompleted > 0);
        existing.onTimeDeliveryPct = otdEntries.length > 0
          ? Math.round(otdEntries.reduce((s, dm) => s + dm.onTimeDeliveryPct, 0) / otdEntries.length)
          : 0;
        const slaEntries = devEntries.filter(dm => dm.ticketsResolved > 0);
        existing.slaCompliancePct = slaEntries.length > 0
          ? Math.round(slaEntries.reduce((s, dm) => s + dm.slaCompliancePct, 0) / slaEntries.length * 10) / 10
          : 0;
        existing.medianResolutionHrs = slaEntries.length > 0
          ? Math.round(slaEntries.reduce((s, dm) => s + dm.medianResolutionHrs, 0) / slaEntries.length * 10) / 10
          : 0;
      }
    }
    return Array.from(devMap.values());
  }, [data, activeMonths, isMultiMonth, selectedMonth]);

  // Team data up to selected month (for trend charts)
  const teamDataUpToSelected = useMemo(() => {
    if (!data) return [];
    return data.teamMetrics
      .filter(m => m.month <= selectedMonth)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data, selectedMonth]);

  const priorityDataUpToSelected = useMemo(() => {
    if (!data) return [];
    return data.onCallPriority.filter(m => m.month <= selectedMonth);
  }, [data, selectedMonth]);

  const bugSlaForMonth = useMemo(() => {
    if (!data) return undefined;
    return data.bugSla.find(m => m.month === selectedMonth);
  }, [data, selectedMonth]);

  // Aggregated team KPIs for multi-month
  const currentTeam = useMemo(() => {
    if (!data) return undefined;
    if (!isMultiMonth) return data.teamMetrics.find(m => m.month === selectedMonth);
    const monthSet = new Set(activeMonths);
    const entries = data.teamMetrics.filter(m => monthSet.has(m.month));
    if (entries.length === 0) return undefined;
    return {
      month: selectedMonth,
      tasksCompleted: entries.reduce((s, e) => s + e.tasksCompleted, 0),
      tasksPerDeveloper: Math.round(entries.reduce((s, e) => s + e.tasksPerDeveloper, 0) / entries.length * 10) / 10,
      onTimeDeliveryPct: Math.round(entries.reduce((s, e) => s + e.onTimeDeliveryPct, 0) / entries.length),
      prodBugs: entries.reduce((s, e) => s + e.prodBugs, 0),
      sbxBugs: entries.reduce((s, e) => s + e.sbxBugs, 0),
      yshubBugsMerchant: entries.reduce((s, e) => s + e.yshubBugsMerchant, 0),
      yshubBugsTeam: entries.reduce((s, e) => s + e.yshubBugsTeam, 0),
      yshubBugsUnknown: entries.reduce((s, e) => s + e.yshubBugsUnknown, 0),
      ticketsResolved: entries.reduce((s, e) => s + e.ticketsResolved, 0),
      slaCompliancePct: Math.round(entries.reduce((s, e) => s + e.slaCompliancePct, 0) / entries.length * 10) / 10,
      medianResolutionDays: Math.round(entries.reduce((s, e) => s + e.medianResolutionDays, 0) / entries.length * 10) / 10,
      activeDevelopers: Math.round(entries.reduce((s, e) => s + e.activeDevelopers, 0) / entries.length),
    };
  }, [data, activeMonths, isMultiMonth, selectedMonth]);

  const prevMonthIdx = allMonths.indexOf(selectedMonth) - 1;
  const prevMonth = prevMonthIdx >= 0 ? allMonths[prevMonthIdx] : undefined;
  const prevTeam = !isMultiMonth && prevMonth ? data?.teamMetrics.find(m => m.month === prevMonth) : undefined;

  const isPartialMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return selectedMonth === currentMonth;
  }, [selectedMonth]);

  const devAllMonths = useMemo(() => {
    if (!selectedDev || !data) return [];
    return data.developerMetrics
      .filter(d => d.developer === selectedDev && d.month <= selectedMonth)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [selectedDev, data, selectedMonth]);

  // Date label for the banner
  const dateLabel = useMemo(() => {
    if (dateMode === "month") return formatMonthLong(pickedMonth);
    if (dateMode === "ytd") return `YTD ${pickedMonth.split("-")[0]} (through ${formatMonth(pickedMonth)})`;
    return `${formatMonth(rangeFrom)} — ${formatMonth(rangeTo)}`;
  }, [dateMode, pickedMonth, rangeFrom, rangeTo]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold">Y</span>
          </div>
          <span className="text-[var(--muted)] text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className={`transition-all duration-300 ${chatOpen ? "sm:mr-[440px]" : ""}`}>
      <Header
        months={allMonths}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        group={group}
        onGroupChange={setGroup}
        onChatToggle={() => setChatOpen(!chatOpen)}
        chatOpen={chatOpen}
        developers={data.developers}
        onDevSelect={setSelectedDev}
        onBugsView={() => setView(view === "bugs" ? "dashboard" : "bugs")}
        bugsViewActive={view === "bugs"}
      />

      {/* ── Sticky Date Banner ── */}
      {view === "dashboard" && (
        <div className="sticky top-[97px] z-20 border-b border-[var(--accent)]/20 bg-[var(--accent)]/10 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-bold text-[var(--accent)]">{dateLabel} Report</span>
            <div className="flex-1 h-px bg-[var(--accent)]/15" />
            <button
              onClick={() => setMethodologyOpen(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--accent)]/60 uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Methodology
            </button>
          </div>
        </div>
      )}

      <main>
        {view === "dashboard" ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

            {/* ── KPI Cards ── */}
            {currentTeam && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
                <div>
                  <div className="section-label mb-2.5">
                    <span style={{ color: "var(--accent)" }}>Integration Requests</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <KpiCard label="Completed Tasks" subtitle="Integrations & feature requests delivered" value={currentTeam.tasksCompleted} prevValue={prevTeam?.tasksCompleted} color="var(--accent)" deltaLabel=" tasks" />
                    <KpiCard label="Tasks / Developer" subtitle="Avg. per active developer this month" value={currentTeam.tasksPerDeveloper} prevValue={prevTeam?.tasksPerDeveloper} color="var(--accent)" />
                    <KpiCard label="Active Developers" subtitle="Devs with at least 1 task or ticket" value={currentTeam.activeDevelopers} prevValue={prevTeam?.activeDevelopers} color="var(--accent)" deltaLabel=" devs" />
                    <KpiCard label="On-Time Delivery" subtitle="% of tasks delivered by deadline" value={currentTeam.onTimeDeliveryPct} suffix="%" prevValue={prevTeam?.onTimeDeliveryPct} color="var(--accent)" deltaLabel="pp" />
                    <KpiCard label="PROD Bugs" subtitle="Bugs found in production" value={currentTeam.prodBugs} prevValue={prevTeam?.prodBugs} color={currentTeam.prodBugs <= 3 ? "var(--accent)" : "var(--danger)"} invertDelta deltaLabel=" bugs" />
                  </div>
                </div>

                <div>
                  <div className="section-label mb-2.5">
                    <span style={{ color: "var(--oncall)" }}>On-Call Support</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <KpiCard label="Tickets Resolved" subtitle="Total support tickets closed" value={currentTeam.ticketsResolved} prevValue={prevTeam?.ticketsResolved} color="var(--oncall)" deltaLabel=" tickets" />
                    <KpiCard label="SLA Compliance" subtitle="% resolved within SLA (done = Deployment in Queue)" value={currentTeam.slaCompliancePct} suffix="%" prevValue={prevTeam?.slaCompliancePct} color="var(--oncall)" deltaLabel="pp" />
                    <KpiCard label="Avg. Resolution Time" subtitle="Median time to Deployment in Queue" value={currentTeam.medianResolutionDays} suffix="d" prevValue={prevTeam?.medianResolutionDays} color="var(--oncall)" invertDelta deltaLabel="d" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Main Panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in anim-d1">
              <IntegrationPanel
                teamData={teamDataUpToSelected}
                developers={aggregatedDevs}
                selectedMonth={selectedMonth}
                onDevClick={setSelectedDev}
                isPartialMonth={isPartialMonth}
              />
              <OnCallPanel
                teamData={teamDataUpToSelected}
                priorityData={priorityDataUpToSelected}
                bugSla={bugSlaForMonth}
                developers={aggregatedDevs}
                selectedMonth={selectedMonth}
                onDevClick={setSelectedDev}
                isPartialMonth={isPartialMonth}
              />
            </div>

            {/* ── Insights ── */}
            <div className="animate-fade-in anim-d2">
              <Insights developers={aggregatedDevs} onDevClick={setSelectedDev} />
            </div>

            {/* ── Developer Roster ── */}
            <div className="animate-fade-in anim-d3">
              <TeamRoster developers={aggregatedDevs} onDevClick={setSelectedDev} />
            </div>
          </div>
        ) : (
          <IntegrationBugsView
            bugs={activeBugs}
            onBack={() => setView("dashboard")}
          />
        )}
      </main>

      </div>{/* end chat-aware wrapper */}

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        currentMonth={selectedMonth}
      />

      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

      {selectedDev && devAllMonths.length > 0 && (
        <DevProfileModal
          developer={selectedDev}
          allMonths={devAllMonths}
          onClose={() => setSelectedDev(null)}
        />
      )}
    </div>
  );
}
