import { NextRequest, NextResponse } from "next/server";
import { loadPerformanceData, filterByMonth, filterByGroup } from "@/lib/data";
import { GroupFilter } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const group = (searchParams.get("group") || "all") as GroupFilter;

  try {
    const data = await loadPerformanceData();

    if (month) {
      const filtered = filterByMonth(data, month);
      const devs = filterByGroup(filtered.developers, group);
      return NextResponse.json({
        team: filtered.team,
        developers: devs,
        onCallPriority: filtered.onCallPriority,
        bugSla: filtered.bugSla,
      });
    }

    const devs = filterByGroup(data.developerMetrics, group);
    return NextResponse.json({
      ...data,
      developerMetrics: devs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Data API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
