"use client";

import { useState, useRef, useEffect } from "react";
import { formatMonth } from "@/lib/format";
import { GroupFilter, Developer } from "@/lib/types";

export type DateMode = "month" | "range" | "ytd";

export interface DateRange {
  mode: DateMode;
  selectedMonth: string;
  rangeFrom: string;
  rangeTo: string;
}

interface Props {
  months: string[];
  dateRange: DateRange;
  onDateRangeChange: (dr: DateRange) => void;
  group: GroupFilter;
  onGroupChange: (group: GroupFilter) => void;
  developers: Developer[];
  onDevSelect: (name: string) => void;
}

const groupLabels: Record<GroupFilter, string> = {
  all: "All Squads",
  "the-hallows": "The Hallows",
  "mortifagos": "Mortifagos",
  "dementors": "Dementors",
  "dedicated-oncall": "Dedicated On-Call",
};

export default function Header({
  months, dateRange, onDateRangeChange, group, onGroupChange, developers, onDevSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { mode, selectedMonth, rangeFrom, rangeTo } = dateRange;

  const filtered = search.trim()
    ? developers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function update(partial: Partial<DateRange>) {
    onDateRangeChange({ ...dateRange, ...partial });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Yuno Logo area */}
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">Y</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--foreground)] leading-tight">Integrations Team</h1>
            <p className="text-[10px] text-[var(--muted)] leading-tight">Performance Dashboard</p>
          </div>
        </div>

        {/* Developer search */}
        <div className="relative" ref={searchRef}>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search developer..."
            className="w-44 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] placeholder:text-[var(--muted-dim)] transition-colors"
          />
          <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {showSearch && filtered.length > 0 && (
            <div className="absolute top-full mt-1 left-0 w-56 rounded-xl border border-[var(--border-light)] bg-[var(--card)] shadow-2xl overflow-hidden z-50">
              {filtered.map(d => (
                <button
                  key={d.name}
                  onClick={() => { onDevSelect(d.name); setSearch(""); setShowSearch(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold">
                    {d.name.split(" ").map(n => n[0]).join("")}
                  </span>
                  <span>{d.name}</span>
                  <span className="ml-auto text-[10px] text-[var(--muted-dim)] capitalize">{d.group.replace(/-/g, " ")}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group */}
        <select
          value={group}
          onChange={(e) => onGroupChange(e.target.value as GroupFilter)}
          className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer hover:border-[var(--border-light)] transition-colors"
        >
          {Object.entries(groupLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>


      </div>

      {/* Date range bar */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2">
          {/* Mode selector */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
            {([
              { key: "month" as DateMode, label: "Month" },
              { key: "range" as DateMode, label: "Range" },
              { key: "ytd" as DateMode, label: "YTD" },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => update({ mode: m.key })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === m.key
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Controls based on mode */}
          {mode === "month" && (
            <select
              value={selectedMonth}
              onChange={e => update({ selectedMonth: e.target.value })}
              className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm font-medium text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          )}

          {mode === "range" && (
            <>
              <label className="text-xs text-[var(--muted)]">From</label>
              <select
                value={rangeFrom}
                onChange={e => {
                  const v = e.target.value;
                  update({ rangeFrom: v, ...(v > rangeTo ? { rangeTo: v } : {}) });
                }}
                className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
              >
                {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
              <label className="text-xs text-[var(--muted)]">To</label>
              <select
                value={rangeTo}
                onChange={e => {
                  const v = e.target.value;
                  update({ rangeTo: v, ...(v < rangeFrom ? { rangeFrom: v } : {}) });
                }}
                className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
              >
                {months.filter(m => m >= rangeFrom).map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
            </>
          )}

          {mode === "ytd" && (
            <>
              <span className="text-xs text-[var(--muted)]">Year to date through</span>
              <select
                value={selectedMonth}
                onChange={e => update({ selectedMonth: e.target.value })}
                className="rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
              >
                {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
            </>
          )}

          {/* Divider + Quick presets */}
          <div className="w-px h-5 bg-[var(--border)]" />
          <div className="flex gap-1">
            {months.slice(-3).map(m => (
              <button
                key={m}
                onClick={() => update({ mode: "month", selectedMonth: m })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === "month" && selectedMonth === m
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
                }`}
              >
                {formatMonth(m)}
              </button>
            ))}
            <button
              onClick={() => update({ mode: "range", rangeFrom: months[0] || "", rangeTo: months[months.length - 1] || "" })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === "range" && rangeFrom === months[0] && rangeTo === months[months.length - 1]
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
