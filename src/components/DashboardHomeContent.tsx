"use client";

import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import DashboardBalance from "@/components/DashboardBalance";
import DashboardStats from "@/components/DashboardStats";
import DashboardTransactions from "@/components/DashboardTransactions";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import StoreHomeDashboard from "@/components/StoreHomeDashboard";
import { useTranslations } from "next-intl";

export default function DashboardHomeContent() {
  const ctx = useDashboardProfile();
  const { profile, loading } = ctx ?? { profile: null, loading: true };
  const isStore = profile?.org_type === "store";
  const t = useTranslations("dashboard");

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>
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
