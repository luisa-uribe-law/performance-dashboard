import { NextRequest, NextResponse } from "next/server";
import { syncMonth } from "@/lib/jira";
import { writeCachedMonth, clearCache } from "@/lib/data";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month parameter required (YYYY-MM)" }, { status: 400 });
  }

  try {
    const result = await syncMonth(month);
    // Persist to disk cache
    writeCachedMonth(month, result);
    clearCache(); // clear in-memory so next /api/data picks up fresh file
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
