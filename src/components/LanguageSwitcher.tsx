"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LOCALE_TRANSITION_STORAGE_KEY,
  useHomeLandingTransitionOptional,
} from "@/components/HomeLandingTransition";
import {
  readClientLocaleCookie,
  writeClientLocaleCookie,
  type SupportedLocale,
} from "@/lib/i18n/locale";

export function LanguageSwitcher({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact";
}) {
  const t = useTranslations("languageSwitcher");
  const landingTransition = useHomeLandingTransitionOptional();
  const [locale, setLocale] = useState<SupportedLocale>(() => readClientLocaleCookie());
  const [saving, setSaving] = useState(false);

  const onChange = useCallback(
    async (next: SupportedLocale) => {
      if (next === locale) return;
      setSaving(true);
      setLocale(next);
      writeClientLocaleCookie(next);
      try {
        await landingTransition?.beginLocaleSwitch();
        await fetch("/api/i18n/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ locale: next }),
        });
        sessionStorage.setItem(LOCALE_TRANSITION_STORAGE_KEY, "1");
        window.location.reload();
      } catch {
        setSaving(false);
      }
    },
    [landingTransition, locale]
  );

  if (variant === "compact") {
    const next: SupportedLocale = locale === "es" ? "en" : "es";
    const label = locale === "es" ? "EN" : "ES";

    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => onChange(next)}
        className={cn(
          "inline-flex min-h-[28px] min-w-[42px] items-center justify-center rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-md",
          "transition-colors hover:bg-white/15 hover:text-white",
          "disabled:cursor-not-allowed disabled:opacity-100",
          className
        )}
        aria-label={t("aria")}
        {...(saving ? { "aria-busy": true as const } : {})}
      >
        {saving ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white"
            aria-hidden
          />
        ) : (
          label
        )}
      </button>
    );
  }

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
        {t("label")}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <select
          value={locale}
          onChange={(e) => onChange((e.target.value as SupportedLocale) || "es")}
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
