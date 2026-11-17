"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProductImageField } from "@/components/ProductImageField";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import type { LaunchedSouvenir } from "@/lib/souvenirs/launch";

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultWindow(): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) };
}

function formatWindow(souvenir: LaunchedSouvenir, language: string): string {
  const start = Date.parse(souvenir.claimStartsAt);
  const end = Date.parse(souvenir.claimEndsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return "";
  const fmt = new Intl.DateTimeFormat(language === "en" ? "en" : "es", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(start)} → ${fmt.format(end)}`;
}

export default function SouvenirsPage() {
  const t = useTranslations("souvenirsPage");
  const locale = useLocale();
  const profile = useDashboardProfile();
  const isStore = profile?.profile?.org_type === "store";
  const [souvenirs, setSouvenirs] = useState<LaunchedSouvenir[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const initialWindow = useMemo(() => defaultWindow(), []);
  const [claimStartsAt, setClaimStartsAt] = useState(initialWindow.start);
  const [claimEndsAt, setClaimEndsAt] = useState(initialWindow.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = locale.startsWith("en") ? "en" : "es";

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/merchant/souvenirs")
      .then((r) => (r.ok ? r.json() : { souvenirs: [] }))
      .then((d) => setSouvenirs(Array.isArray(d.souvenirs) ? d.souvenirs : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    const next = defaultWindow();
    setTitle("");
    setImageUrl(null);
    setClaimStartsAt(next.start);
    setClaimEndsAt(next.end);
    setError(null);
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t("errorTitle"));
      return;
    }
    if (!imageUrl) {
      setError(t("errorImage"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/merchant/souvenirs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl,
          claimStartsAt: new Date(claimStartsAt).toISOString(),
          claimEndsAt: new Date(claimEndsAt).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("errorCreateFailed"));
        return;
      }
      resetForm();
      load();
    } finally {
      setBusy(false);
    }
  };

  if (!isStore && profile?.profile) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("storesOnly")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
          >
            {t("newSouvenir")}
          </button>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-200">
        {t("hint")}
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("titleLabel")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              maxLength={80}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              required
            />
          </div>

          <ProductImageField imageUrl={imageUrl} disabled={busy} onChange={(next) => setImageUrl(next)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("startsLabel")}</label>
              <input
                type="datetime-local"
                value={claimStartsAt}
                onChange={(e) => setClaimStartsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("endsLabel")}</label>
              <input
                type="datetime-local"
                value={claimEndsAt}
                onChange={(e) => setClaimEndsAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("windowHint")}</p>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 text-sm"
            >
              {busy ? t("creating") : t("createButton")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("listTitle")}</h2>
        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : souvenirs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {souvenirs.map((souvenir) => (
              <div
                key={souvenir.slug}
                className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4"
              >
                {souvenir.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={souvenir.imagePath} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white">{souvenir.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatWindow(souvenir, language)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
