"use client";

import { useState, useEffect, useCallback } from "react";
import { Squad } from "@/lib/types";

interface RosterEntry {
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

const SQUADS: { id: string; label: string; color: string }[] = [
  { id: "the-hallows", label: "The Hallows", color: "var(--accent)" },
  { id: "mortifagos", label: "Mortifagos", color: "var(--success)" },
  { id: "dementors", label: "Dementors", color: "var(--warning)" },
  { id: "dedicated-oncall", label: "Dedicated On-Call", color: "var(--oncall)" },
];

function squadColor(group: string): string {
  return SQUADS.find(s => s.id === group)?.color || "var(--muted)";
}

function squadLabel(group: string): string {
  return SQUADS.find(s => s.id === group)?.label || group;
}

type Tab = "active" | "inactive";

export default function TeamPage() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<RosterEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDev, setNewDev] = useState<RosterEntry>({
    displayName: "", jiraNames: [], email: "", github: "", group: "the-hallows", active: true,
  });
  const [addError, setAddError] = useState("");

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

  // Group by squad
  const grouped = SQUADS.map(squad => ({
    ...squad,
    devs: displayList.filter(d => d.group === squad.id),
  })).filter(g => g.devs.length > 0);

  async function saveEdit() {
    if (!editData) return;
    setSaving(true);
    await fetch("/api/roster", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setSaving(false);
    setEditing(null);
    setEditData(null);
    fetchRoster();
  }

  async function deactivateDev(dev: RosterEntry) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await fetch("/api/roster", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dev, active: false, activeTo: month }),
    });
    fetchRoster();
  }

  async function reactivateDev(dev: RosterEntry) {
    await fetch("/api/roster", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dev, active: true, activeTo: undefined }),
    });
    fetchRoster();
  }

  async function addDev() {
    if (!newDev.displayName.trim()) return;
    setAddError("");
    setSaving(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const entry: RosterEntry = {
        ...newDev,
        jiraNames: newDev.jiraNames.length > 0 ? newDev.jiraNames : [newDev.displayName],
        activeFrom: month,
        active: true,
      };
      const resp = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (resp.ok) {
        setAdding(false);
        setAddError("");
        setNewDev({ displayName: "", jiraNames: [], email: "", github: "", group: "the-hallows", active: true });
        fetchRoster();
      } else {
        const data = await resp.json();
        setAddError(data.error || `Failed (${resp.status})`);
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <span className="text-[var(--muted)] text-sm">Loading team...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <a href="/" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm">
            &larr; Dashboard
          </a>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[var(--foreground)]">Team Management</h1>
            <p className="text-[11px] text-[var(--muted)]">{activeDevs.length} active &middot; {inactiveDevs.length} inactive</p>
          </div>
          <button
            onClick={() => { setAdding(true); setAddError(""); }}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:brightness-110 transition-all"
          >
            + Add Developer
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-0.5 bg-[var(--surface)] rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              tab === "active"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Active ({activeDevs.length})
          </button>
          <button
            onClick={() => setTab("inactive")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              tab === "inactive"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
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
                    <th className="py-2 px-4 text-left text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">GitHub</th>
                    <th className="py-2 px-4 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Squad</th>
                    <th className="py-2 px-4 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Status</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {squad.devs.map(dev => {
                    const isEditing = editing === dev.displayName;
                    return (
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
                        <td className="py-2.5 px-4">
                          {dev.github ? (
                            <a href={`https://github.com/${dev.github}`} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent)] hover:underline">
                              @{dev.github}
                            </a>
                          ) : (
                            <span className="text-[12px] text-[var(--muted-dim)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isEditing && editData ? (
                            <select
                              value={editData.group}
                              onChange={e => setEditData({ ...editData, group: e.target.value })}
                              className="text-[11px] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--foreground)]"
                            >
                              {SQUADS.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color: squad.color, borderColor: squad.color }}>
                              {squad.label}
                            </span>
                          )}
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
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={saveEdit} disabled={saving} className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--accent)] text-white hover:brightness-110 transition-all disabled:opacity-50">
                                  {saving ? "..." : "Save"}
                                </button>
                                <button onClick={() => { setEditing(null); setEditData(null); }} className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditing(dev.displayName); setEditData({ ...dev }); }}
                                  className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] transition-colors"
                                >
                                  Edit
                                </button>
                                {dev.active ? (
                                  <button
                                    onClick={() => deactivateDev(dev)}
                                    className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 border border-[var(--danger)]/20 transition-colors"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => reactivateDev(dev)}
                                    className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 border border-[var(--success)]/20 transition-colors"
                                  >
                                    Reactivate
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Add Developer Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAdding(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-light)] bg-[var(--background)] shadow-2xl animate-fade-in p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--foreground)]">Add Developer</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={newDev.displayName}
                  onChange={e => setNewDev({ ...newDev, displayName: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Jira Display Names (comma-separated)</label>
                <input
                  type="text"
                  value={newDev.jiraNames.join(", ")}
                  onChange={e => setNewDev({ ...newDev, jiraNames: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. John Doe, John D"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={newDev.email}
                  onChange={e => setNewDev({ ...newDev, email: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="name@y.uno"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">GitHub Username</label>
                <input
                  type="text"
                  value={newDev.github}
                  onChange={e => setNewDev({ ...newDev, github: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="github-username"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Squad</label>
                <select
                  value={newDev.group}
                  onChange={e => setNewDev({ ...newDev, group: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {SQUADS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {addError && (
              <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg px-3 py-2">
                {addError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg bg-[var(--surface)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] transition-colors">
                Cancel
              </button>
              <button onClick={addDev} disabled={saving || !newDev.displayName.trim()} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                {saving ? "Adding..." : "Add Developer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (for full field editing) */}
      {editing && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setEditing(null); setEditData(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-light)] bg-[var(--background)] shadow-2xl animate-fade-in p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--foreground)]">Edit — {editData.displayName}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Jira Display Names (comma-separated)</label>
                <input
                  type="text"
                  value={editData.jiraNames.join(", ")}
                  onChange={e => setEditData({ ...editData, jiraNames: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={e => setEditData({ ...editData, email: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">GitHub Username</label>
                <input
                  type="text"
                  value={editData.github}
                  onChange={e => setEditData({ ...editData, github: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">Squad</label>
                <select
                  value={editData.group}
                  onChange={e => setEditData({ ...editData, group: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {SQUADS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setEditing(null); setEditData(null); }} className="px-4 py-2 rounded-lg bg-[var(--surface)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
