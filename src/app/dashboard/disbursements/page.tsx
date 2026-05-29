"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DisbursementAuthorizeModal,
  type DisbursementAuthorizeResult,
} from "@/components/DisbursementAuthorizeModal";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SdpDisbursement {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset: { code: string; issuer: string };
  wallet: { id: string; name: string };
  created_at: string;
}

interface SdpWallet {
  id: string;
  name: string;
  homepage: string;
}

interface SdpPayment {
  id: string;
  amount: string;
  status: string;
  stellar_transaction_id: string | null;
  receiver: { id: string; email?: string; phone_number?: string };
  created_at: string;
}

interface DraftRecipient {
  name: string;
  email: string;
  phone: string;
  amount: string;
  verification: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STELLAR_EXPERT =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  READY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  STARTED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-gray-500",
  READY: "text-blue-600",
  PENDING: "text-yellow-600",
  PAUSED: "text-yellow-500",
  SUCCESS: "text-green-600",
  FAILED: "text-red-600",
};

const DELETABLE_DISBURSEMENT_STATUSES = new Set(["DRAFT", "READY"]);

const EMPTY_FORM: DraftRecipient = {
  name: "",
  email: "",
  phone: "",
  amount: "",
  verification: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function recipientsToCSV(recipients: DraftRecipient[], defaultAmount: string): string {
  const rows = recipients.map((r) => {
    const id = r.name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const email = r.email.trim();
    const amount = (r.amount || defaultAmount || "0").trim();
    const verification = r.verification.trim() || "2000-01-01";
    return `${email},${id},${amount},${verification}`;
  });
  return "email,id,amount,verification\n" + rows.join("\n");
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DisbursementsPage() {
  const t = useTranslations("disbursementsPage");
  const { profile } = useDashboardProfile() ?? { profile: null };
  const isDisbursementAdmin =
    profile?.can_manage_disbursements === true ||
    profile?.admin_level === "admin" ||
    profile?.admin_level === "super_admin";

  // List view
  const [disbursements, setDisbursements] = useState<SdpDisbursement[]>([]);
  const [wallets, setWallets] = useState<SdpWallet[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Create form — shared
  const [showCreate, setShowCreate] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Manual mode — draft recipient list + add form
  const [draftRecipients, setDraftRecipients] = useState<DraftRecipient[]>([]);
  const [recipientForm, setRecipientForm] = useState<DraftRecipient>(EMPTY_FORM);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // CSV mode
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    disbursement: SdpDisbursement;
    payments: SdpPayment[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Actions
  const [startingId, setStartingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [authorizeDisbursementId, setAuthorizeDisbursementId] = useState<string | null>(null);

  // ── Fetch list ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/sdp/disbursements");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setListError(j.error ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setDisbursements(data.disbursements ?? []);
      setWallets(data.wallets ?? []);
      if ((data.wallets ?? []).length > 0 && !selectedWalletId) {
        setSelectedWalletId(data.wallets[0].id);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Network error");
    } finally {
      setListLoading(false);
    }
  }, [selectedWalletId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Fetch detail ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/sdp/disbursements/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setDetailError(j.error ?? `Error ${res.status}`);
          return;
        }
        const data = await res.json();
        setDetail({ disbursement: data.disbursement, payments: data.payments ?? [] });
      })
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Add recipient to draft ────────────────────────────────────────────────

  function handleAddRecipient() {
    const { name, email } = recipientForm;
    if (!name.trim() || !email.trim()) return;
    setDraftRecipients((prev) => [...prev, { ...recipientForm }]);
    setRecipientForm(EMPTY_FORM);
    nameInputRef.current?.focus();
  }

  function handleRecipientKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRecipient();
    }
  }

  function removeRecipient(index: number) {
    setDraftRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function setField(field: keyof DraftRecipient, value: string) {
    setRecipientForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── Create disbursement ───────────────────────────────────────────────────

  function resetCreateForm() {
    setBatchName("");
    setDraftRecipients([]);
    setRecipientForm(EMPTY_FORM);
    setDefaultAmount("");
    setCsvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!selectedWalletId) {
      setCreateError(t("errorNoWallet"));
      return;
    }

    let fileToUpload: File;

    if (inputMode === "manual") {
      if (draftRecipients.length === 0) {
        setCreateError(t("errorNoRecipients"));
        return;
      }
      const missingEmail = draftRecipients.some((r) => !r.email.trim());
      if (missingEmail) {
        setCreateError(t("errorMissingEmail"));
        return;
      }
      const missingAmount = draftRecipients.some((r) => !r.amount.trim() && !defaultAmount.trim());
      if (missingAmount) {
        setCreateError(t("errorMissingAmount"));
        return;
      }
      const csvString = recipientsToCSV(draftRecipients, defaultAmount);
      fileToUpload = new File([csvString], "disbursement.csv", { type: "text/csv" });
    } else {
      if (!csvFile) {
        setCreateError(t("errorNoFile"));
        return;
      }
      fileToUpload = csvFile;
    }

    setCreating(true);

    const form = new FormData();
    form.append("name", batchName);
    form.append("walletId", selectedWalletId);
    form.append("file", fileToUpload);

    try {
      const res = await fetch("/api/sdp/disbursements", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? `Error ${res.status}`);
        return;
      }
      setShowCreate(false);
      resetCreateForm();
      await fetchList();
      setSelectedId(data.disbursement.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  // ── Start disbursement (passkey authorization required) ───────────────────

  function handleStart(id: string) {
    setActionMsg(null);
    setAuthorizeDisbursementId(id);
  }

  async function completeStart(id: string, auth: DisbursementAuthorizeResult) {
    setStartingId(id);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: auth.sessionId,
          credentialId: auth.credentialId,
          contractId: auth.contractId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
        return;
      }
      setAuthorizeDisbursementId(null);
      setActionMsg(t("disbursementStarted"));
      await fetchList();
      if (selectedId === id) setSelectedId(null);
      setTimeout(() => setSelectedId(id), 100);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setStartingId(null);
    }
  }

  // ── Send invites ──────────────────────────────────────────────────────────

  async function handleSendInvites(id: string) {
    setSendingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/send-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: "Sozu" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
        return;
      }
      setActionMsg(
        t("invitesSent", { sent: data.sent, skipped: data.skipped, failed: data.failed })
      );
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setSendingId(null);
    }
  }

  // ── Delete batch (admin only; DRAFT / READY) ───────────────────────────────

  async function handleDelete(id: string, name: string) {
    if (!isDisbursementAdmin) return;
    if (!window.confirm(t("deleteConfirm", { name }))) return;

    setDeletingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? t("deleteFailed");
        setActionMsg(
          res.status === 400 && /started|cannot delete/i.test(String(msg))
            ? t("deleteStartedError")
            : `Error: ${msg}`
        );
        return;
      }
      setActionMsg(t("deleteSuccess"));
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await fetchList();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        {isDisbursementAdmin && (
          <button
            onClick={() => {
              setShowCreate((v) => !v);
              setCreateError(null);
            }}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {showCreate ? t("cancel") : t("newBatch")}
          </button>
        )}
      </div>

      {/* Action message banner */}
      {actionMsg && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 flex items-start justify-between gap-3">
          <span>{actionMsg}</span>
          <button
            onClick={() => setActionMsg(null)}
            className="shrink-0 text-blue-500 hover:text-blue-700 font-medium"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("createTitle")}
          </h2>

          {listError && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {t("sdpWarning", { error: listError })}
            </p>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            {/* Batch name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("batchNameLabel")}
              </label>
              <input
                required
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={t("batchNamePlaceholder")}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Wallet — hidden from NGO user when only one option exists */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("walletLabel")}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t("walletHint")}
              </p>

              {wallets.length === 1 ? (
                /* Single wallet — auto-selected, shown as a friendly read-only pill */
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-3 py-1 text-sm font-medium text-green-800 dark:text-green-300">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {wallets[0].name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {t("walletAutoSelected")} · {wallets[0].homepage}
                  </span>
                </div>
              ) : wallets.length > 1 ? (
                /* Multiple wallets — show name only, no UUID */
                <select
                  required
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.homepage})
                    </option>
                  ))}
                </select>
              ) : (
                /* Wallets not loaded yet (SDP unreachable) — show UUID fallback */
                <input
                  required
                  type="text"
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  placeholder={t("walletPlaceholder")}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Input mode toggle */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("inputModeLabel")}
              </p>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden w-fit">
                {(["manual", "csv"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInputMode(mode)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      inputMode === mode
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {mode === "manual" ? t("modeManual") : t("modeCsv")}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Manual mode ──────────────────────────────────────────────── */}
            {inputMode === "manual" && (
              <div className="space-y-4">
                {/* Default amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("defaultAmountLabel")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value)}
                    placeholder={t("defaultAmountPlaceholder")}
                    className="w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Recipient add form */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("recipientSectionTitle")}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t("nameLabel")}
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={recipientForm.name}
                        onChange={(e) => setField("name", e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder={t("namePlaceholder")}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t("emailLabel")}
                      </label>
                      <input
                        type="email"
                        value={recipientForm.email}
                        onChange={(e) => setField("email", e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder={t("emailPlaceholder")}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t("phoneLabel")}
                      </label>
                      <input
                        type="tel"
                        value={recipientForm.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder={t("phonePlaceholder")}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t("amountLabel")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={recipientForm.amount}
                        onChange={(e) => setField("amount", e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder={defaultAmount || t("amountPlaceholder")}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Verification (date of birth) */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t("verificationLabel")}
                      </label>
                      <input
                        type="date"
                        value={recipientForm.verification}
                        onChange={(e) => setField("verification", e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        className="w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {t("verificationHint")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    disabled={!recipientForm.name.trim() || !recipientForm.email.trim()}
                    className="mt-1 px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 transition-colors"
                  >
                    {t("addRecipient")}
                  </button>
                </div>

                {/* Draft list */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("draftTitle", { count: draftRecipients.length })}
                  </p>

                  {draftRecipients.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                      {t("noDraftYet")}
                    </p>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                              {t("colName")}
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                              {t("colEmail")}
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                              {t("colPhone")}
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                              {t("colAmountDraft")}
                            </th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {draftRecipients.map((r, i) => (
                            <tr
                              key={i}
                              className="border-t border-gray-100 dark:border-gray-800"
                            >
                              <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium truncate max-w-[140px]">
                                {r.name}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[160px]">
                                {r.email}
                              </td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-500 hidden sm:table-cell">
                                {r.phone || "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                {r.amount || defaultAmount || "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeRecipient(i)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  aria-label={t("removeRecipient")}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── CSV mode ─────────────────────────────────────────────────── */}
            {inputMode === "csv" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("csvLabel")}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("csvColumns")}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="cursor-pointer px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {csvFile ? csvFile.name : t("csvUploadLabel")}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  <a
                    href="/sdp-disbursement-template.csv"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {t("csvDownload")}
                  </a>
                </div>
                {csvFile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {csvFile.name} ({Math.round(csvFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? t("creating") : t("createBatch")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Disbursements list ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {listLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>
        )}
        {!listLoading && listError && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {t("sdpError")}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{listError}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{t("sdpEnvHint")}</p>
          </div>
        )}
        {!listLoading && !listError && disbursements.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>
        )}

        {disbursements.map((d) => (
          <div
            key={d.id}
            className={`rounded-xl border cursor-pointer transition-colors ${
              selectedId === d.id
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{d.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {d.total_payments} {t("payments")} · {d.asset.code} · {d.wallet.name}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {isDisbursementAdmin &&
                  DELETABLE_DISBURSEMENT_STATUSES.has(d.status) && (
                    <button
                      type="button"
                      title={t("deleteBatch")}
                      disabled={deletingId === d.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(d.id, d.name);
                      }}
                      className="px-2 py-1 rounded text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                    >
                      {deletingId === d.id ? t("deleting") : t("deleteBatch")}
                    </button>
                  )}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[d.status] ?? STATUS_COLORS.DRAFT
                  }`}
                >
                  {d.status}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {d.total_amount} {d.asset.code}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    selectedId === d.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {selectedId === d.id && (
              <div
                className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {(d.status === "READY" || d.status === "DRAFT") && (
                    <button
                      onClick={() => handleStart(d.id)}
                      disabled={startingId === d.id}
                      className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {startingId === d.id ? t("starting") : t("startPayments")}
                    </button>
                  )}
                  <button
                    onClick={() => handleSendInvites(d.id)}
                    disabled={sendingId === d.id}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {sendingId === d.id ? t("sending") : t("sendInvites")}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setTimeout(() => setSelectedId(d.id), 100);
                    }}
                    className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {t("refresh")}
                  </button>
                  {isDisbursementAdmin &&
                    DELETABLE_DISBURSEMENT_STATUSES.has(d.status) && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(d.id, d.name)}
                        disabled={deletingId === d.id}
                        className="px-3 py-1.5 rounded border border-red-300 dark:border-red-800 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60"
                      >
                        {deletingId === d.id ? t("deleting") : t("deleteBatch")}
                      </button>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: t("statTotal"), value: d.total_payments },
                    { label: t("statSuccessful"), value: d.successful_payments },
                    { label: t("statFailed"), value: d.failed_payments },
                    {
                      label: t("statDisbursed"),
                      value: `${d.disbursed_amount} ${d.asset.code}`,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Payments table */}
                {detailLoading && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("loading")}</p>
                )}
                {detailError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
                )}
                {!detailLoading && detail?.disbursement.id === d.id && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colRecipient")}
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colAmount")}
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colStatus")}
                          </th>
                          <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">
                            {t("colTxHash")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                              {p.receiver.email ??
                                p.receiver.phone_number ??
                                p.receiver.id.slice(0, 8)}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-900 dark:text-white font-medium">
                              {p.amount} {d.asset.code}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`text-xs font-medium ${
                                  PAYMENT_STATUS_COLORS[p.status] ?? "text-gray-500"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2">
                              {p.stellar_transaction_id ? (
                                <a
                                  href={`${STELLAR_EXPERT}/tx/${p.stellar_transaction_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-600 hover:underline"
                                  title={p.stellar_transaction_id}
                                >
                                  {p.stellar_transaction_id.slice(0, 12)}…
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">{t("pending")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {detail.payments.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-4 text-center text-sm text-gray-400"
                            >
                              {t("noPayments")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {authorizeDisbursementId && (
        <DisbursementAuthorizeModal
          open
          disbursementId={authorizeDisbursementId}
          onClose={() => setAuthorizeDisbursementId(null)}
          onAuthorized={(auth) => completeStart(authorizeDisbursementId, auth)}
        />
      )}
    </div>
  );
}
