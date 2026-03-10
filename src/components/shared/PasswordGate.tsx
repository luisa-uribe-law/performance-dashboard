"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "dashboard-auth";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === "integrations") {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthenticated(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  if (checking) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
          <span className="text-white font-bold text-lg">Y</span>
        </div>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Performance Dashboard</h1>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false); }}
          placeholder="Enter password"
          autoFocus
          className={`w-full px-4 py-2.5 rounded-lg border text-sm bg-[var(--card)] text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)] ${error ? "border-red-500 shake" : "border-[var(--border)]"}`}
        />
        {error && <span className="text-red-500 text-xs">Incorrect password</span>}
        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
