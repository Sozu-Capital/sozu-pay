"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Locale = "es" | "en";
const LOCALE_COOKIE = "sozupay_locale";

function readLocaleCookie(): Locale {
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  const value = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
  return value === "en" ? "en" : "es";
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("languageSwitcher");
  const [locale, setLocale] = useState<Locale>("es");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocale(readLocaleCookie());
  }, []);

  const onChange = useCallback(
    async (next: Locale) => {
      setLocale(next);
      setSaving(true);
      try {
        await fetch("/api/i18n/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locale: next }),
        });
      } finally {
        setSaving(false);
        window.location.reload();
      }
    },
    []
  );

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
        {t("label")}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <select
          value={locale}
          onChange={(e) => onChange((e.target.value as Locale) || "es")}
          disabled={saving}
          className="w-full rounded-md border border-white/10 bg-black/30 text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          aria-label={t("aria")}
        >
          <option value="es">{t("es")}</option>
          <option value="en">{t("en")}</option>
        </select>
      </div>
    </div>
  );
}
