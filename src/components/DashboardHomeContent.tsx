"use client";

import Link from "next/link";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import DashboardBalance from "@/components/DashboardBalance";
import DashboardStats from "@/components/DashboardStats";
import DashboardTransactions from "@/components/DashboardTransactions";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import StoreHomeDashboard from "@/components/StoreHomeDashboard";
import { TagSoftPrompt } from "@/components/TagSoftPrompt";
import { useTranslations } from "next-intl";

export default function DashboardHomeContent() {
  const ctx = useDashboardProfile();
  const { profile, loading, balance } = ctx ?? { profile: null, loading: true, balance: null };
  const isStore = profile?.org_type === "store";
  const t = useTranslations("dashboard");
  const showFundCta =
    !isStore &&
    !!profile?.org_id &&
    (balance == null || Number.parseFloat(balance.usdc || "0") === 0);

  // Wait until profile is resolved so we mount the right layout once and avoid
  // the NGO components briefly mounting before switching to the store layout.
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (isStore) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white">
          {t("storeTitle")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("storeSubtitle")}
        </p>
        <div className="mt-6">
          <StoreHomeDashboard />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TagSoftPrompt />
      <h1 className="text-2xl font-bold text-white">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>
      {showFundCta ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="flex-1 text-sm text-emerald-900 dark:text-emerald-100">
            {t("fundTreasuryHint")}
          </p>
          <Link
            href="/dashboard/checkout"
            className="inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {t("fundTreasuryCta")}
          </Link>
        </div>
      ) : null}
      <section className="mt-6" aria-label={t("keyMetrics")}>
        <DashboardStats />
      </section>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DashboardBalance />
        <OnboardingChecklist />
      </div>
      <section className="mt-8" aria-label={t("recentActivity")}>
        <DashboardTransactions />
      </section>
    </div>
  );
}
