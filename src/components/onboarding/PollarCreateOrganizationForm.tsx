"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

/**
 * NGO Pollar path: name-only org create. No passkey / smart-account / PIN.
 * Server provisions Org treasury as creator-bound Staff Pollar wallet.
 */
export function PollarCreateOrganizationForm() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.createOrg");
  const tCommon = useTranslations("onboardingPages");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("pollarNameRequired"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/profile/org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, type: "ngo" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("createFailed"));
        return;
      }
      const redirect =
        typeof data.redirect === "string" && data.redirect.startsWith("/")
          ? data.redirect
          : "/dashboard";
      router.replace(redirect);
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DarkGradientBg>
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-white">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur-sm"
        >
          <h1 className="text-xl font-semibold">{t("pollarTitle")}</h1>
          <p className="mt-2 text-sm text-gray-300">{t("pollarSubtitle")}</p>

          <label className="mt-6 block text-sm text-gray-300" htmlFor="org-name">
            {t("orgNameLabel")}
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-white/40"
            placeholder={t("orgNamePlaceholder")}
            autoComplete="organization"
            disabled={busy}
          />

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-md bg-white py-2.5 font-medium text-gray-900 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? tCommon("loading") : t("pollarCreateCta")}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            <Link href="/join" className="underline underline-offset-2 hover:text-gray-200">
              {t("haveInviteSecondary")}
            </Link>
          </p>
        </form>
      </main>
    </DarkGradientBg>
  );
}
