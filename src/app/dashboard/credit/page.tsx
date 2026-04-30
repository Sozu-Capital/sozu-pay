"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CreditPoolDonut } from "@/components/CreditPoolDonut";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { CREDIT_DASHBOARD_USE_MOCK } from "@/lib/credit/credit-dashboard-mock-flag";
import {
  MOCK_ORG_CREDIT_LOANS,
  MOCK_ORG_CREDIT_SUMMARY,
} from "@/lib/credit/mock-org-dashboard";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type Summary = {
  pendingApplicationCount: number;
  activeLoanCount: number;
  totalPrincipalDisbursed: number;
  totalOutstandingApprox: number;
  overdueApprox: number;
  applicationCounts: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
};

type LoanRow = {
  loan: { id: string; principal: number };
  applicantEmail: string;
  outstanding: number;
  nextDue: string | null;
  health: "on_track" | "at_risk" | "overdue";
};

export default function CreditPage() {
  const t = useTranslations("creditPage");
  const { profile, loading: profileLoading } = useDashboardProfile() ?? {
    profile: null,
    loading: true,
  };
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isStaff =
    profile?.admin_level === "admin" ||
    profile?.admin_level === "super_admin";

  useEffect(() => {
    if (!isStaff || profileLoading) {
      setLoading(false);
      return;
    }
    if (CREDIT_DASHBOARD_USE_MOCK) {
      setSummary(MOCK_ORG_CREDIT_SUMMARY);
      setLoans(MOCK_ORG_CREDIT_LOANS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [sRes, lRes] = await Promise.all([
          fetch("/api/credit/org/summary", { credentials: "include" }),
          fetch("/api/credit/org/loans", { credentials: "include" }),
        ]);
        if (sRes.ok) {
          const d = await sRes.json();
          if (!cancelled) setSummary(d);
        }
        if (lRes.ok) {
          const d = await lRes.json();
          if (!cancelled) setLoans(d.loans ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, profileLoading]);

  const healthLabel = (status: string) => {
    if (status === "on_track") return t("healthOnTrack");
    if (status === "at_risk") return t("healthAtRisk");
    return t("healthOverdue");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t("title")}
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
        {t("intro")}
      </p>

      {isStaff && (
        <p className="mt-3">
          <Link
            href="/dashboard/credit-applications"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Review credit applications
          </Link>
        </p>
      )}

      {loading || profileLoading ? (
        <div className="mt-8 animate-pulse h-40 rounded-lg bg-gray-100 dark:bg-gray-800" />
      ) : isStaff && summary ? (
        <>
          {CREDIT_DASHBOARD_USE_MOCK && (
            <>
              <p className="mt-4 text-xs font-medium text-amber-800 dark:text-amber-200/90">
                Demo metrics — set NEXT_PUBLIC_CREDIT_DASHBOARD_MOCK=false for live org data.
              </p>
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("poolSummary")}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("totalVolume")} · {t("availableCredit")} · {t("allocated")} · {t("inRepayment")} ·{" "}
                  {t("overdue")}
                </p>
                <div className="mt-4">
                  <CreditPoolDonut />
                </div>
              </div>
            </>
          )}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Pending applications
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {summary.pendingApplicationCount}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Active loans
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {summary.activeLoanCount}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Principal disbursed
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {formatUsd(summary.totalPrincipalDisbursed)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500">
                Outstanding (approx)
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatUsd(summary.totalOutstandingApprox)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Connect as NGO staff to see live credit pool metrics, or use the public portal at{" "}
          <Link href="/credit" className="text-blue-600 dark:text-blue-400 underline">
            /credit
          </Link>
          .
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("allocationTitle")}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("allocationSubtitle")}
        </p>
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("colRecipient")}</th>
                <th className="text-left p-3 font-medium">{t("colAllocated")}</th>
                <th className="text-left p-3 font-medium">{t("colHealth")}</th>
                <th className="text-left p-3 font-medium">{t("colNextDue")}</th>
              </tr>
            </thead>
            <tbody>
              {!isStaff || loans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-gray-500 text-center">
                    {isStaff
                      ? "No active loans yet."
                      : "Staff view shows live allocations."}
                  </td>
                </tr>
              ) : (
                loans.map((row) => (
                  <tr
                    key={row.loan.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="p-3 font-medium">{row.applicantEmail}</td>
                    <td className="p-3 tabular-nums">
                      {formatUsd(row.loan.principal)}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          row.health === "on_track"
                            ? "text-green-600 dark:text-green-400"
                            : row.health === "at_risk"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        }
                      >
                        {healthLabel(row.health)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {row.nextDue ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/recipients" className="underline hover:no-underline">
          {t("manageRecipients")}
        </Link>
        {" · "}
        <Link href="/dashboard/payouts" className="underline hover:no-underline">
          {t("payoutsLink")}
        </Link>
      </p>
    </div>
  );
}
