"use client";

import { useState, useEffect, useCallback } from "react";

interface RosterEntry {
  displayName: string;
  jiraNames: string[];
  email: string;
  group: string;
  role?: string;
  active: boolean;
  activeFrom?: string;
  activeTo?: string;
}

const SQUADS: { id: string; label: string; color: string }[] = [
  { id: "the-hallows", label: "The Hallows", color: "var(--accent)" },
  { id: "mortifagos", label: "Mortifagos", color: "var(--success)" },
  { id: "dementors", label: "Dementors", color: "var(--warning)" },
  { id: "dedicated-oncall", label: "Dedicated On-Call", color: "var(--oncall)" },
];

type Tab = "active" | "inactive";

export default function TeamView() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");

  const fetchRoster = useCallback(() => {
    fetch("/api/roster").then(r => r.json()).then((data: RosterEntry[]) => {
      setRoster(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const activeDevs = roster.filter(r => r.active);
  const inactiveDevs = roster.filter(r => !r.active);
  const displayList = tab === "active" ? activeDevs : inactiveDevs;

  const grouped = SQUADS.map(squad => ({
    ...squad,
    devs: displayList.filter(d => d.group === squad.id),
  })).filter(g => g.devs.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--muted)] text-sm">Loading team...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Team Roster</h2>
        <span className="text-[11px] text-[var(--muted)]">{activeDevs.length} active &middot; {inactiveDevs.length} inactive</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] w-fit">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
            tab === "active"
              ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Active ({activeDevs.length})
        </button>
        <button
          onClick={() => setTab("inactive")}
          className={`px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
            tab === "inactive"
              ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Inactive ({inactiveDevs.length})
        </button>
      </div>

      {/* Grouped by squad */}
      {grouped.map(squad => (
        <div key={squad.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: squad.color }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: squad.color }}>{squad.label}</span>
            <span className="text-[10px] text-[var(--muted)]">({squad.devs.length})</span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface)]">
                  <th className="py-2 px-4 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Name</th>
                  <th className="py-2 px-4 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Email</th>
                  <th className="py-2 px-4 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Squad</th>
                  <th className="py-2 px-4 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {squad.devs.map(dev => (
                  <tr key={dev.displayName} className={`border-t border-[var(--border)] transition-colors ${!dev.active ? "opacity-50" : ""}`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: squad.color }}>
                          {dev.displayName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[var(--foreground)] text-[13px]">{dev.displayName}</span>
                            {dev.role && (
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                dev.role === "Tech Lead"
                                  ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                                  : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                              }`}>{dev.role}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[12px] text-[var(--muted)]">{dev.email}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color: squad.color, borderColor: squad.color }}>
                        {SQUADS.find(s => s.id === dev.group)?.label || dev.group}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {dev.active ? (
                        <span className="text-[10px] font-bold text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <div>
                          <span className="text-[10px] font-bold text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">Inactive</span>
                          {dev.activeTo && <div className="text-[9px] text-[var(--muted)] mt-0.5">since {dev.activeTo}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {displayList.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)] text-sm">
          {tab === "active" ? "No active developers" : "No inactive developers"}
        </div>
      )}
    </div>
  );
}
