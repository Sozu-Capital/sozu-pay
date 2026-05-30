"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { useSignOut } from "@/lib/auth/useSignOut";

type Org = { id: string; name: string };

export default function OrganizationsPage() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.organizations");
  const tCommon = useTranslations("onboardingPages");
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { signOut, signingOut } = useSignOut();

  useEffect(() => {
    fetch("/api/profile/organizations", {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) =>
        r.ok
          ? r.json()
          : { organizations: [], canCreate: true }
      )
      .then((d) => {
        setOrganizations(d.organizations ?? []);
      })
      .catch(() => {
        setOrganizations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectOrg(orgId: string) {
    setError("");
    setSelectingId(orgId);
    try {
      const res = await fetch("/api/auth/set-org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("selectFailed"));
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError(tCommon("somethingWentWrong"));
    } finally {
      setSelectingId(null);
    }
  }

  if (loading) {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <p className="text-sm text-gray-300">{tCommon("loading")}</p>
        </main>
      </DarkGradientBg>
    );
  }

  const hasOrgs = organizations.length > 0;

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
          <p className="mt-2 text-sm text-gray-300">{t("subtitle")}</p>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {hasOrgs && (
            <ul className="mt-6 space-y-2">
              {organizations.map((org) => (
                <li key={org.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectOrg(org.id)}
                    disabled={!!selectingId}
                    className="w-full rounded-md border border-white/10 bg-white/5 py-3 px-4 text-left font-medium text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    <span className="block truncate">{org.name}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {selectingId === org.id ? t("opening") : t("continue")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/onboarding/create-organization"
              className="w-full text-center rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
            >
              {t("createNew")}
            </Link>
          </div>

          {!hasOrgs && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-400">{t("noOrgHint")}</p>
              <button
                type="button"
                onClick={() => signOut()}
                disabled={signingOut}
                className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
              >
                {signingOut ? t("signingOut") : t("logOut")}
              </button>
            </div>
          )}
        </div>
      </main>
    </DarkGradientBg>
  );
}
