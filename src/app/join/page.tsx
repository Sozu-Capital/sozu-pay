"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * Secondary entry: paste/open a Staff invite token (create-org remains primary onboarding CTA).
 */
export default function JoinIndexPage() {
  const t = useTranslations("staffInvite");
  const router = useRouter();
  const [token, setToken] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = token.trim().replace(/^.*\/join\//, "");
    if (!clean) return;
    router.push(`/join/${encodeURIComponent(clean)}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t("haveInviteTitle")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("haveInviteBody")}</p>
        <form onSubmit={go} className="space-y-3">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t("tokenPlaceholder")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            aria-label={t("tokenPlaceholder")}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 text-sm font-medium"
          >
            {t("continue")}
          </button>
        </form>
        <p className="text-xs text-gray-400">
          <Link href="/onboarding/create-organization" className="underline underline-offset-2">
            {t("createOrgInstead")}
          </Link>
          {" · "}
          <Link href="/" className="underline underline-offset-2">
            {t("backHome")}
          </Link>
        </p>
      </div>
    </main>
  );
}
