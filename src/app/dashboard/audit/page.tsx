"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface PayoutAuditMetadata {
  signerWallet?: string;
  recipientId?: string;
  amount?: string;
  asset?: string;
  stellarTxHash?: string;
  destination?: string;
  recipientLabel?: string;
}

interface AuditEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  userId?: string;
  metadata?: PayoutAuditMetadata;
}

export default function AuditPage() {
  const t = useTranslations("auditPage");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: { admin_level?: string }) => setIsSuperAdmin((p.admin_level ?? "") === "super_admin"));
  }, []);

  const isPayoutType = (type: string) =>
    type === "payout_approved" ||
    type === "payout" ||
    type === "treasury_to_distribution" ||
    type === "distribution_to_treasury";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>
      {loading ? (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800" />
          <div className="animate-pulse h-12 bg-gray-50 dark:bg-gray-800/50" />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-6 text-gray-500 dark:text-gray-400">{t("empty")}</p>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.map((e) => (
              <li key={e.id} className="p-4 flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(e.at).toLocaleString()} · {e.type}
                  </p>
                  {e.metadata && (e.metadata.signerWallet ?? e.metadata.amount ?? e.metadata.recipientId ?? e.metadata.destination ?? e.metadata.recipientLabel) && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {e.metadata.signerWallet && (
                        <p><span className="text-gray-500 dark:text-gray-500">{t("signer")}:</span> <span className="font-mono">{e.metadata.signerWallet.slice(0, 8)}…{e.metadata.signerWallet.slice(-4)}</span></p>
                      )}
                      {e.metadata.recipientId && (
                        <p><span className="text-gray-500 dark:text-gray-500">{t("recipientId")}:</span> {e.metadata.recipientId}</p>
                      )}
                      {e.metadata.amount != null && (
                        <p><span className="text-gray-500 dark:text-gray-500">{t("amount")}:</span> {e.metadata.amount} USDC</p>
                      )}
                      {e.metadata.destination && (
                        <p><span className="text-gray-500 dark:text-gray-500">{t("destination")}:</span> <span className="font-mono">{e.metadata.destination.slice(0, 8)}…{e.metadata.destination.slice(-4)}</span></p>
                      )}
                      {e.metadata.recipientLabel && !e.message.includes(e.metadata.recipientLabel) && (
                        <p><span className="text-gray-500 dark:text-gray-500">{t("recipient")}:</span> {e.metadata.recipientLabel}</p>
                      )}
                    </div>
                  )}
                </div>
                {isSuperAdmin && isPayoutType(e.type) && (
                  <Link
                    href="/dashboard/admin"
                    className="shrink-0 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t("requestKyc")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
