"use client";

import { MonthlyTeamMetrics, OnCallPriorityMetrics } from "@/lib/types";
import TrendChart from "../shared/TrendChart";
import MetricTable from "../shared/MetricTable";
import SectionCard from "../shared/SectionCard";

interface Props {
  teamData: MonthlyTeamMetrics[];
  priorityData: OnCallPriorityMetrics[];
  selectedMonth: string;
}

export default function OnCallOverview({ teamData, priorityData, selectedMonth }: Props) {
  const monthPriority = priorityData.filter(p => p.month === selectedMonth);

  return (
    <SectionCard title="On-Call Results" subtitle="YSHUB Support Metrics">
      <div className="space-y-5">
        <TrendChart
          data={teamData}
          xKey="month"
          areas={[
            { key: "ticketsResolved", color: "#A78BFA", name: "Tickets Resolved" },
            { key: "slaCompliancePct", color: "var(--yuno-green)", name: "SLA %" },
          ]}
          height={180}
        />
        <div>
          <div className="text-[11px] font-medium text-[var(--muted)] mb-2 uppercase tracking-wider">Resolution by Priority</div>
          <MetricTable
            columns={[
              { key: "priority", label: "Priority" },
              { key: "medianResolutionHrs", label: "Median Resolution", formatter: (v) => `${v}h`, align: "right" },
              { key: "slaCompliancePct", label: "SLA %", formatter: (v) => `${v}%`, align: "right" },
            ]}
            data={monthPriority}
            highlightField="slaCompliancePct"
            highlightColor="var(--success)"
          />
        </div>
      </div>
    </SectionCard>
  );
}
