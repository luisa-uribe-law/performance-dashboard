import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { clearCache } from "@/lib/data";

const ROSTER_PATH = path.join(process.cwd(), "data/roster.json");

export interface RosterEntry {
  displayName: string;
  jiraNames: string[];
  email: string;
  github: string;
  group: string;
  role?: string;
  active: boolean;
  activeFrom?: string;
  activeTo?: string;
}

async function readRoster(): Promise<RosterEntry[]> {
  const raw = await fs.readFile(ROSTER_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeRoster(roster: RosterEntry[]): Promise<void> {
  await fs.writeFile(ROSTER_PATH, JSON.stringify(roster, null, 2), "utf-8");
}

export async function GET() {
  const roster = await readRoster();
  return NextResponse.json(roster);
}

export async function PUT(request: NextRequest) {
  const updated: RosterEntry = await request.json();
  const roster = await readRoster();

  const idx = roster.findIndex(r => r.displayName === updated.displayName);
  if (idx === -1) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  roster[idx] = updated;
  await writeRoster(roster);
  clearCache();
  return NextResponse.json(roster[idx]);
}

export async function POST(request: NextRequest) {
  const newDev: RosterEntry = await request.json();
  const roster = await readRoster();

  if (roster.some(r => r.displayName === newDev.displayName)) {
    return NextResponse.json({ error: "Developer already exists" }, { status: 409 });
  }

  roster.push(newDev);
  await writeRoster(roster);
  clearCache();
  return NextResponse.json(newDev, { status: 201 });
}
