"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Session = {
  id: string;
  status: string;
  amountUsd: string;
  reference: string | null;
  createdAt: string;
};

export default function CheckoutPage() {
  const t = useTranslations("checkoutPage");
  const [amountUsd, setAmountUsd] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ checkoutUrl: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    fetch("/api/checkout/list")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const amount = parseFloat(amountUsd);
    if (!isFinite(amount) || amount <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amountUsd.trim(), reference: reference.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("createFailed"));
        return;
      }
      setResult({ checkoutUrl: data.checkoutUrl, id: data.id });
      setAmountUsd("");
      setReference("");
      loadSessions();
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: no-op
    }
  };

  const statusColor = (s: string) =>
    s === "completed"
      ? "text-emerald-600 dark:text-emerald-400"
      : s === "failed"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">{t("newLink")}</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("amountLabel")}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 font-medium">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">USD</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("referenceLabel")}
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t("referencePlaceholder")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {busy ? t("creating") : t("createButton")}
        </button>
      </form>

      {/* Created link */}
      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t("linkReady")}</p>
          <p className="mt-1 text-xs break-all text-gray-700 dark:text-gray-300">{result.checkoutUrl}</p>
          <button
            onClick={() => copyLink(result.checkoutUrl)}
            className="mt-3 rounded-lg border border-emerald-400 dark:border-emerald-600 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
          >
            {copied ? t("copied") : t("copyLink")}
          </button>
        </div>
      )}

      {/* History */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("historyTitle")}</h2>
        {loadingSessions ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("noHistory")}</p>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="text-left p-3 font-medium">{t("colDate")}</th>
                  <th className="text-left p-3 font-medium">{t("colAmount")}</th>
                  <th className="text-left p-3 font-medium">{t("colRef")}</th>
                  <th className="text-left p-3 font-medium">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">${s.amountUsd}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{s.reference ?? "—"}</td>
                    <td className={`p-3 font-medium capitalize ${statusColor(s.status)}`}>
                      {s.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
