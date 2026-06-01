"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

function StatCard({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          {value}
        </p>
        {sub != null && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {sub}
          </p>
        )}
      </div>
      <div className="rounded-lg bg-gray-100 dark:bg-gray-700/50 p-2 text-gray-600 dark:text-gray-300">
        {icon}
      </div>
    </div>
  );
  const className =
    "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5 shadow-sm block transition hover:border-gray-300 dark:hover:border-gray-600";
  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

export default function DashboardStats() {
  const t = useTranslations("dashboardStats");
  const ctx = useDashboardProfile();
  const loading = ctx?.loading ?? true;
  const data = ctx?.stats ?? null;

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
          >
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-8 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  const formatUsd = (s: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(s));

  const balanceUsd = data?.balanceUsd ?? "0";
  const txCount = data?.transactionCount ?? 0;
  const apyPercent = data?.apyPercent ?? 0;
  const creditUsd = data?.creditAvailableUsd ?? "0";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        href="/dashboard/vault"
        label={t("orgBalance")}
        value={formatUsd(balanceUsd)}
        sub={t("orgBalanceSub")}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        href="/dashboard/transactions"
        label={t("transactions")}
        value={String(txCount)}
        sub={t("transactionsSub")}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        }
      />
      <StatCard
        href="/dashboard/vault"
        label={t("apy")}
        value={`${apyPercent}%`}
        sub={t("apySub")}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
      <StatCard
        href="/dashboard/settings"
        label={t("creditAvailable")}
        value={formatUsd(creditUsd)}
        sub={t("creditSub")}
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
      />
    </div>
  );
}
