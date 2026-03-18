"use client";

import { useState } from "react";
import { MonthlyTeamMetrics } from "@/lib/types";
import TrendChart from "../shared/TrendChart";
import SectionCard from "../shared/SectionCard";

interface Props {
  data: MonthlyTeamMetrics[];
}

const metrics = [
  { id: "output", label: "Output" },
  { id: "delivery", label: "Delivery" },
  { id: "bugs", label: "Bugs" },
] as const;

export default function DemOverview({ data }: Props) {
  const [tab, setTab] = useState<string>("output");

  return (
    <SectionCard title="Integration Ops" subtitle="DEM Board Performance">
      <div className="flex gap-1 mb-4 bg-[var(--surface)] rounded-lg p-1">
        {metrics.map(m => (
          <button
            key={m.id}
            onClick={() => setTab(m.id)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
              tab === m.id
                ? "bg-[var(--yuno-blue)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {tab === "output" && (
        <TrendChart
          data={data}
          xKey="month"
          areas={[
            { key: "tasksCompleted", color: "var(--yuno-blue)", name: "Tasks Completed" },
          ]}
          height={200}
        />
      )}
      {tab === "delivery" && (
        <TrendChart
          data={data}
          xKey="month"
          areas={[
            { key: "onTimeDeliveryPct", color: "#E0ED80", name: "OTD %" },
          ]}
          yDomain={[0, 100]}
          yFormatter={(v) => `${v}%`}
          height={200}
        />
      )}
      {tab === "bugs" && (
        <TrendChart
          data={data}
          xKey="month"
          bars={[
            { key: "prodBugs", color: "var(--danger)", name: "PROD Bugs" },
            { key: "sbxBugs", color: "var(--warning)", name: "SBX Bugs" },
          ]}
          height={200}
        />
      )}
    </SectionCard>
  );
}
