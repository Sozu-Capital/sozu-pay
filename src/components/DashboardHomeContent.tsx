"use client";

import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import DashboardBalance from "@/components/DashboardBalance";
import DashboardStats from "@/components/DashboardStats";
import DashboardTransactions from "@/components/DashboardTransactions";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import StoreHomeDashboard from "@/components/StoreHomeDashboard";
import { useTranslations } from "next-intl";

export default function DashboardHomeContent() {
  const { profile } = useDashboardProfile() ?? { profile: null };
  const isStore = profile?.org_type === "store";
  const t = useTranslations("dashboard");

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
