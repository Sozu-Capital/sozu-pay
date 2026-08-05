"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

const STORAGE_KEY = "sozupay_tag_soft_prompt_dismissed";

/**
 * Dismissible nudge for optional Sozu tag / Org Sozu tag after first NGO landing.
 * Tags stay optional — create-org never requires them.
 */
export function TagSoftPrompt() {
  const t = useTranslations("tagSoftPrompt");
  const { profile } = useDashboardProfile() ?? { profile: null };
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (profile?.org_type === "store") return;
    if (!profile?.org_id) return;
    if (profile.username) return; // already has personal Sozu tag
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }
    setVisible(true);
  }, [profile?.org_id, profile?.org_type, profile?.username]);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-sky-950 dark:text-sky-100">{t("title")}</p>
        <p className="mt-1 text-sm text-sky-800 dark:text-sky-200">{t("body")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/settings"
          className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
          onClick={dismiss}
        >
          {t("addTags")}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-sky-900"
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
