"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

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
    <DarkGradientBg>
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center text-white">
          <h1 className="text-2xl font-semibold text-white">{t("haveInviteTitle")}</h1>
          <p className="text-sm text-white/75">{t("haveInviteBody")}</p>
          <form onSubmit={go} className="space-y-3">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("tokenPlaceholder")}
              className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40"
              aria-label={t("tokenPlaceholder")}
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black"
            >
              {t("continue")}
            </button>
          </form>
          <p className="text-xs text-white/50">
            <Link href="/onboarding/create-organization" className="underline underline-offset-2 hover:text-white">
              {t("createOrgInstead")}
            </Link>
            {" · "}
            <Link href="/" className="underline underline-offset-2 hover:text-white">
              {t("backHome")}
            </Link>
          </p>
        </div>
      </main>
    </DarkGradientBg>
  );
}
