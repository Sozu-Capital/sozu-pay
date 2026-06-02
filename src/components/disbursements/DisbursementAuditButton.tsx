"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface AuditEvent {
  id: string;
  at: string;
  action: string;
  actorLabel: string;
  message: string;
}

type Props = {
  disbursementId: string;
  disbursementName: string;
};

export function DisbursementAuditButton({ disbursementId, disbursementName }: Props) {
  const t = useTranslations("disbursementsPage");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${disbursementId}/audit`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [disbursementId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={t("auditHover")}
        aria-label={t("auditHover")}
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 sm:w-96 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {t("auditTitle", { name: disbursementName })}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {loading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1 py-2">{t("loading")}</p>
            )}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1 py-2">{error}</p>
            )}
            {!loading && !error && events.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1 py-2">{t("auditEmpty")}</p>
            )}
            <ul className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="text-xs px-1">
                  <p className="text-gray-800 dark:text-gray-200">{ev.message}</p>
                  <p className="text-gray-500 dark:text-gray-500 mt-0.5">
                    {new Date(ev.at).toLocaleString()} · {ev.actorLabel}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
