import { NextRequest, NextResponse } from "next/server";
import { computeTimeBlocked } from "@/lib/jira";
import { readCachedTimeBlocked, writeCachedTimeBlocked } from "@/lib/data";
import { TimeBlockedMonthly } from "@/lib/types";

// In-memory cache (populated from disk or live compute)
const memCache = new Map<string, { data: TimeBlockedMonthly; fetchedAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = searchParams.get("months");
  const forceSync = searchParams.get("sync") === "true"; // used by cron

  if (!months) {
    return NextResponse.json({ error: "months parameter required" }, { status: 400 });
  }

  try {
    const monthList = months.split(",").filter(m => /^\d{4}-\d{2}$/.test(m));
    const results: TimeBlockedMonthly[] = [];

    for (const month of monthList) {
      // 1. In-memory cache (skip if force sync)
      if (!forceSync) {
        const mem = memCache.get(month);
        if (mem && Date.now() - mem.fetchedAt < CACHE_TTL_MS) {
          results.push(mem.data);
          continue;
        }
      }

      // 2. On-disk JSON cache (skip if force sync)
      if (!forceSync) {
        const disk = readCachedTimeBlocked(month);
        if (disk) {
          memCache.set(month, { data: disk, fetchedAt: Date.now() });
          results.push(disk);
          continue;
        }
      }

      // 3. Compute live from Jira
      const data = await computeTimeBlocked(month);
      memCache.set(month, { data, fetchedAt: Date.now() });
      writeCachedTimeBlocked(month, data);
      results.push(data);
    }

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Time-blocked API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
