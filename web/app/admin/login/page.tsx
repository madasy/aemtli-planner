"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";

  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Login failed");
      } else {
        router.replace(next);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 backdrop-blur-sm bg-white/60" />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white/90 shadow-xl p-6">
          <h1 className="text-lg font-semibold mb-4 text-center">Admin Login</h1>
          <label className="block text-sm mb-1">Passwort</label>
          <input
            type="password"
            className="w-full border rounded-md px-3 py-2 mb-3"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          <button type="submit" disabled={busy || !pwd}
                  className={`w-full rounded-md px-3 py-2 text-white ${busy ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
            {busy ? "Anmelden…" : "Anmelden"}
          </button>
          <p className="mt-3 text-center text-xs text-gray-500">Zugriff nur für Berechtigte.</p>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  // Suspense fixes: “useSearchParams() should be wrapped in a suspense boundary”
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Lade…</div>}>
      <LoginInner />
    </Suspense>
  );
}
