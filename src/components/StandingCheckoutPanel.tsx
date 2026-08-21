"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Standing = {
  id: string;
  checkoutSlug: string;
  amountUsd: string;
  live: boolean;
  deadlineAt: string | null;
  namedCheckoutUrl: string | null;
};

export function StandingCheckoutPanel() {
  const t = useTranslations("checkoutPage");
  const [slug, setSlug] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Standing[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/standing-checkouts")
      .then((r) => (r.ok ? r.json() : { checkouts: [] }))
      .then((d) => {
        setRows(d.checkouts ?? []);
        setStoreSlug(typeof d.storeSlug === "string" ? d.storeSlug : null);
      })
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/standing-checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutSlug: slug.trim(),
          amountUsd: amountUsd.trim(),
          deadlineAt: deadlineAt.trim() ? new Date(deadlineAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("createFailed"));
        return;
      }
      setSlug("");
      setAmountUsd("");
      setDeadlineAt("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleLive(row: Standing) {
    await fetch(`/api/standing-checkouts/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ live: !row.live }),
    });
    load();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white">{t("standingTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("standingSubtitle")}</p>
      {storeSlug ? (
        <p className="mt-1 text-xs text-gray-500">
          {t("storeSlugLabel")}: /{storeSlug}
        </p>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4 max-w-xl"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("checkoutSlugLabel")}
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="almuerzo"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("amountLabel")}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("deadlineLabel")}
          </label>
          <input
            type="datetime-local"
            value={deadlineAt}
            onChange={(e) => setDeadlineAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2 px-4 text-sm"
        >
          {busy ? t("creating") : t("standingCreate")}
        </button>
      </form>

      <ul className="mt-6 space-y-2 max-w-xl">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{row.checkoutSlug}</span>
              <span className="text-gray-500">${row.amountUsd}</span>
            </div>
            <p className="mt-1 break-all text-xs text-gray-500">{row.namedCheckoutUrl ?? "—"}</p>
            <p className="mt-1 text-xs text-gray-500">
              {row.live ? t("standingLive") : t("standingOff")}
              {row.deadlineAt ? ` · ${row.deadlineAt}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              {row.namedCheckoutUrl ? (
                <button
                  type="button"
                  className="text-xs underline text-gray-600 dark:text-gray-300"
                  onClick={() => void copyUrl(row.namedCheckoutUrl!)}
                >
                  {copied === row.namedCheckoutUrl ? t("copied") : t("copyLink")}
                </button>
              ) : null}
              <button
                type="button"
                className="text-xs underline text-gray-600 dark:text-gray-300"
                onClick={() => void toggleLive(row)}
              >
                {row.live ? t("standingTurnOff") : t("standingTurnOn")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
