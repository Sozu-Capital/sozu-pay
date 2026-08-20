"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DisbursementAuditButton } from "@/components/disbursements/DisbursementAuditButton";

interface HistoryRecord {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset_code: string;
  wallet_name: string;
  created_at: string;
  archived_at: string;
  archive_reason: "deleted" | "completed" | "closed";
  archived_by_label?: string;
}

function archiveReasonLabel(
  reason: HistoryRecord["archive_reason"],
  t: ReturnType<typeof useTranslations>
): string {
  if (reason === "deleted") return t("historyDeleted");
  if (reason === "closed") return t("historyClosed");
  return t("historyCompleted");
}

export default function DisbursementHistoryPage() {
  const t = useTranslations("disbursementsPage");
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sdp/disbursements/history")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Error ${res.status}`);
          return;
        }
        setHistory(data.history ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t("historyTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("historySubtitle")}</p>
        </div>
        <Link
          href="/dashboard/disbursements"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
        >
          {t("backToDisbursements")}
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">{t("loading")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && history.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("historyEmpty")}</p>
      )}

      <ul className="space-y-2">
        {history.map((h) => (
          <li
            key={`${h.id}-${h.archived_at}`}
            className={`rounded-xl border bg-white dark:bg-gray-900 px-5 py-4 ${
              highlightId === h.id
                ? "border-blue-500 ring-1 ring-blue-500/30"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{h.name}</p>
                  <DisbursementAuditButton disbursementId={h.id} disbursementName={h.name} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {archiveReasonLabel(h.archive_reason, t)} ·{" "}
                  {h.successful_payments}/{h.total_payments} {t("payments")}
                  {h.failed_payments > 0 ? ` · ${h.failed_payments} ${t("paymentFailed")}` : null} ·{" "}
                  {h.asset_code}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {h.total_amount} {h.asset_code}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {t("historyCreated")}: {new Date(h.created_at).toLocaleString()}
              <br />
              {t("historyArchived")}: {new Date(h.archived_at).toLocaleString()}
              {h.archived_by_label ? ` · ${h.archived_by_label}` : null}
            </p>
            <div className="mt-3">
              <Link
                href={`/dashboard/disbursements?id=${encodeURIComponent(h.id)}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("historyViewBatch")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
