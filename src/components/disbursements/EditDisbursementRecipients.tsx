"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  receiversToRecipientRows,
  type RecipientRow,
} from "@/lib/disbursements/csv";
import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";

type Props = {
  disbursementId: string;
  receivers: Array<{
    email?: string;
    phone_number?: string;
    external_id?: string;
    payment?: { amount?: string; verification_field_value?: string; verification?: string } | null;
  }>;
  uploadedVerificationByEmail?: Record<string, string>;
  onSaved: () => void;
};

const EMPTY: RecipientRow = {
  name: "",
  email: "",
  phone: "",
  amount: "",
  verification: "",
};

export function EditDisbursementRecipients({
  disbursementId,
  receivers,
  uploadedVerificationByEmail = {},
  onSaved,
}: Props) {
  const t = useTranslations("disbursementsPage");
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [form, setForm] = useState<RecipientRow>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setRows(receiversToRecipientRows(receivers, uploadedVerificationByEmail));
    }
  }, [editing, receivers, uploadedVerificationByEmail]);

  function addRow() {
    if (!form.name.trim() || !form.email.trim()) return;
    const rawVerification = form.verification?.trim() ?? "";
    const verification = rawVerification
      ? (normalizeVerificationForSdp(rawVerification) ?? "")
      : "";
    if (!verification) {
      setError(t("errorMissingVerification"));
      return;
    }
    setError(null);
    setRows((prev) => [...prev, { ...form, verification }]);
    setForm(EMPTY);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRowVerification(index: number, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, verification: normalizeVerificationForSdp(value) ?? value.trim() }
          : row
      )
    );
  }

  async function save() {
    if (rows.length === 0) {
      setError(t("errorNoRecipients"));
      return;
    }
    const missingDob = rows.some((r) => !normalizeVerificationForSdp(r.verification ?? ""));
    if (missingDob) {
      setError(t("errorMissingVerification"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const normalizedRows = rows.map((r) => ({
        ...r,
        verification: normalizeVerificationForSdp(r.verification ?? "") ?? "",
      }));
      const res = await fetch(`/api/sdp/disbursements/${disbursementId}/recipients`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: normalizedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {t("editRecipients")}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("editRecipientsTitle")}</p>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          {t("cancel")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
        />
        <input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder={t("amountPlaceholder")}
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder={t("verificationPlaceholder")}
          value={form.verification}
          onChange={(e) => setForm((f) => ({ ...f, verification: e.target.value }))}
          onBlur={(e) => {
            const n = normalizeVerificationForSdp(e.target.value);
            if (n && n !== e.target.value.trim()) {
              setForm((f) => ({ ...f, verification: n }));
            }
          }}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm font-mono"
        />
      </div>
      <button
        type="button"
        onClick={addRow}
        disabled={!form.name.trim() || !form.email.trim()}
        className="text-sm text-blue-600 dark:text-blue-400 disabled:opacity-40"
      >
        + {t("addRecipient")}
      </button>

      {rows.length > 0 && (
        <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
          {rows.map((r, i) => (
            <li
              key={`${r.email}-${i}`}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 space-y-2"
            >
              <div className="flex justify-between gap-2 text-gray-700 dark:text-gray-300">
                <span className="truncate">
                  {r.name} · {r.email} · {r.amount || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-red-500 shrink-0 text-xs"
                >
                  {t("removeRecipient")}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder={t("verificationPlaceholder")}
                value={r.verification ?? ""}
                onChange={(e) => updateRowVerification(i, e.target.value)}
                onBlur={(e) => {
                  const n = normalizeVerificationForSdp(e.target.value);
                  if (n && n !== e.target.value.trim()) updateRowVerification(i, n);
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-2 py-1 text-xs font-mono"
              />
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? t("savingRecipients") : t("saveRecipients")}
      </button>
    </div>
  );
}
