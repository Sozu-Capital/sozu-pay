"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DisbursementAuthorizeModal,
  type DisbursementAuthorizeResult,
} from "@/components/DisbursementAuthorizeModal";
import PayoutStatusModal, { type PayoutModalSuccess } from "@/components/PayoutStatusModal";
import { DisbursementAuditButton } from "@/components/disbursements/DisbursementAuditButton";
import { BeneficiaryFieldCell } from "@/components/disbursements/BeneficiaryFieldCell";
import { EditDisbursementRecipients } from "@/components/disbursements/EditDisbursementRecipients";
import { DistributionTreasuryPanel } from "@/components/disbursements/DistributionTreasuryPanel";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { recipientsToCSV, parseDisbursementCsvText, findDuplicateEmailsInRecipients } from "@/lib/disbursements/csv";
import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";
import { executePasskeyDistributionTransfer } from "@/lib/stellar/smartAccounts/executePasskeyDistributionTransfer";
import { executePasskeySorobanPayout } from "@/lib/stellar/smartAccounts/signSorobanPayout";
import type { BeneficiaryLifecycleState } from "@/lib/sdp/receiverDisplay";
import { batchRemainingUsdc } from "@/lib/disbursements/mergeDisbursementStats";
import type { DisbursementMeta } from "@/lib/disbursements/store";

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
  payment_status: string;
  lifecycle_state: BeneficiaryLifecycleState;
  stellar_transaction_id: string | null;
  beneficiary_name: string;
  legal_name: string;
  date_of_birth: string | null;
  date_of_birth_source?: "uploaded" | "sdp" | null;
  sozu_tag: string | null;
  contact: string | null;
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

const CARD_ACTION_BTN =
  "px-3 py-1.5 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed";

interface PayableDisbursementItem {
  paymentId: string;
  amount: string;
  recipientAddress: string;
  recipientLabel: string;
  receiverEmail?: string;
}

interface DistribuirContext {
  disbursementId: string;
  batchName: string;
  items: PayableDisbursementItem[];
  totalAmount: string;
}

interface SdpReceiverRow {
  email?: string;
  phone_number?: string;
  external_id?: string;
  payment?: {
    amount?: string;
    verification_field_value?: string;
    verification?: string;
  } | null;
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
  ARCHIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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

const LIFECYCLE_STATUS_COLORS: Record<BeneficiaryLifecycleState, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  live: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const DELETABLE_DISBURSEMENT_STATUSES = new Set(["DRAFT", "READY", "PAUSED", "STARTED"]);
const EDITABLE_RECIPIENT_STATUSES = new Set(["DRAFT", "READY"]);

function formatBatchAmount(n: number): string {
  if (n <= 0) return "0";
  return n.toFixed(7).replace(/\.?0+$/, "");
}

const EMPTY_FORM: DraftRecipient = {
  name: "",
  email: "",
  phone: "",
  amount: "",
  verification: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSdpConfigError(message: string, status?: number): boolean {
  if (status === 401) return false;
  if (/^unauthorized$/i.test(message.trim())) return false;
  return /SDP_|not configured|missing at runtime/i.test(message);
}

function formatSozuTag(tag: string | null): string {
  if (!tag) return "—";
  return tag.startsWith("$") ? tag : `$${tag}`;
}

const DISBURSEMENT_STATUS_KEYS = new Set([
  "DRAFT",
  "READY",
  "STARTED",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
  "FAILED",
]);

function formatDisbursementStatus(
  status: string,
  t: ReturnType<typeof useTranslations<"disbursementsPage">>
): string {
  const key = status.toUpperCase();
  if (key === "COMPLETED") return t("campaignPaid");
  if (DISBURSEMENT_STATUS_KEYS.has(key)) {
    return t(`disbursementStatus.${key}` as "disbursementStatus.DRAFT");
  }
  return status;
}

function formatPaymentStatus(
  status: string,
  t: ReturnType<typeof useTranslations<"disbursementsPage">>
): string {
  const key = status.toUpperCase();
  if (key === "FAILED") return t("paymentStatus.FAILED");
  if (key in { DRAFT: 1, READY: 1, PENDING: 1, PAUSED: 1, SUCCESS: 1 }) {
    return t(`paymentStatus.${key}` as "paymentStatus.DRAFT");
  }
  return status;
}


// ── Component ────────────────────────────────────────────────────────────────

export default function DisbursementsPage() {
  const t = useTranslations("disbursementsPage");
  const searchParams = useSearchParams();
  const { profile } = useDashboardProfile() ?? { profile: null };
  const { ready: kitReady, kit, credentialId } = useSmartAccountKitContext();
  const isDisbursementAdmin =
    profile?.can_manage_disbursements === true ||
    profile?.admin_level === "admin" ||
    profile?.admin_level === "super_admin";

  // List view
  const [disbursements, setDisbursements] = useState<SdpDisbursement[]>([]);
  const [metaById, setMetaById] = useState<Record<string, DisbursementMeta>>({});
  const [wallets, setWallets] = useState<SdpWallet[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listErrorCode, setListErrorCode] = useState<string | null>(null);

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
    receivers?: SdpReceiverRow[];
    uploadedVerificationByEmail?: Record<string, string>;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [savingBeneficiaryEmail, setSavingBeneficiaryEmail] = useState<string | null>(null);

  // Actions
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [distributingId, setDistributingId] = useState<string | null>(null);
  const [committingId, setCommittingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [autoReleaseAuthorizeId, setAutoReleaseAuthorizeId] = useState<string | null>(null);
  const [distribuirContext, setDistribuirContext] = useState<DistribuirContext | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutModalStatus, setPayoutModalStatus] = useState<
    "confirm" | "submitting" | "success" | "failed"
  >("confirm");
  const [payoutModalSuccess, setPayoutModalSuccess] = useState<PayoutModalSuccess | null>(null);
  const [payoutModalError, setPayoutModalError] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [togglingAutoId, setTogglingAutoId] = useState<string | null>(null);
  const [distributionUsdc, setDistributionUsdc] = useState<string>("0");
  const [distributionConfigured, setDistributionConfigured] = useState(false);

  // ── Fetch list ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    setListErrorCode(null);
    try {
      const res = await fetch("/api/sdp/disbursements");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const errMsg = typeof j.error === "string" ? j.error : `Error ${res.status}`;
        setListError(errMsg);
        setListErrorCode(
          typeof j.code === "string"
            ? j.code
            : res.status === 401
              ? "SESSION_EXPIRED"
              : res.status === 503
                ? "SDP_NOT_CONFIGURED"
                : null
        );
        return;
      }
      const data = await res.json();
      setDisbursements(data.disbursements ?? []);
      setMetaById(data.meta ?? {});
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

  useEffect(() => {
    const openId = searchParams.get("id")?.trim();
    if (openId) setSelectedId(openId);
  }, [searchParams]);

  const archivedBatchOpen =
    Boolean(selectedId) &&
    !disbursements.some((d) => d.id === selectedId) &&
    detail?.disbursement.id === selectedId;

  // ── Fetch detail ──────────────────────────────────────────────────────────

  const refreshDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDetailError(j.error ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setDetail({
        disbursement: data.disbursement,
        payments: data.payments ?? [],
        receivers: data.receivers ?? [],
        uploadedVerificationByEmail: data.uploadedVerificationByEmail ?? {},
      });
      if (data.meta) {
        setMetaById((prev) => ({ ...prev, [id]: data.meta }));
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Network error");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void refreshDetail(selectedId);
  }, [selectedId, refreshDetail]);

  // Parse CSV into editable draft rows when a file is selected
  useEffect(() => {
    if (inputMode !== "csv" || !csvFile) {
      if (inputMode === "csv") setDraftRecipients([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseDisbursementCsvText(String(reader.result ?? ""));
        setDraftRecipients(
          rows.map((r) => ({
            name: r.name,
            email: r.email,
            phone: r.phone ?? "",
            amount: r.amount,
            verification: r.verification ?? "",
          }))
        );
        setCreateError(null);
      } catch {
        setDraftRecipients([]);
        setCreateError(t("errorInvalidCsv"));
      }
    };
    reader.readAsText(csvFile);
  }, [csvFile, inputMode, t]);

  // ── Add recipient to draft ────────────────────────────────────────────────

  function handleAddRecipient() {
    const { name, email } = recipientForm;
    if (!name.trim() || !email.trim()) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (
      draftRecipients.some((r) => r.email.trim().toLowerCase() === normalizedEmail)
    ) {
      setCreateError(t("errorDuplicateEmail", { email: email.trim() }));
      return;
    }
    const normalized = normalizeVerificationForSdp(recipientForm.verification);
    if (!normalized) {
      setCreateError(
        recipientForm.verification.trim()
          ? t("errorInvalidVerification")
          : t("errorMissingVerification")
      );
      return;
    }
    setCreateError(null);
    setDraftRecipients((prev) => [
      ...prev,
      { ...recipientForm, verification: normalized },
    ]);
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

  function updateDraftRecipient(index: number, patch: Partial<DraftRecipient>) {
    setDraftRecipients((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  async function saveBeneficiaryField(
    disbursementId: string,
    email: string,
    patch: { legalName?: string; dateOfBirth?: string }
  ) {
    setSavingBeneficiaryEmail(email);
    setDetailError(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${disbursementId}/beneficiary`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailError(data.error ?? `Error ${res.status}`);
        return;
      }
      await refreshDetail(disbursementId);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingBeneficiaryEmail(null);
    }
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

    const buildCsvFile = () => {
      const missingEmail = draftRecipients.some((r) => !r.email.trim());
      if (missingEmail) {
        setCreateError(t("errorMissingEmail"));
        return null;
      }
      const missingAmount = draftRecipients.some(
        (r) => !r.amount.trim() && !defaultAmount.trim()
      );
      if (missingAmount) {
        setCreateError(t("errorMissingAmount"));
        return null;
      }
      const missingName = draftRecipients.some((r) => !r.name.trim());
      if (missingName) {
        setCreateError(t("errorMissingLegalName"));
        return null;
      }
      const missingVerification = draftRecipients.some((r) => {
        const v = normalizeVerificationForSdp(r.verification ?? "");
        return !v;
      });
      if (missingVerification) {
        setCreateError(t("errorMissingVerification"));
        return null;
      }
      const duplicateEmails = findDuplicateEmailsInRecipients(draftRecipients);
      if (duplicateEmails.length > 0) {
        setCreateError(
          duplicateEmails.length === 1
            ? t("errorDuplicateEmail", { email: duplicateEmails[0]! })
            : t("errorDuplicateEmails", { emails: duplicateEmails.join(", ") })
        );
        return null;
      }
      const csvString = recipientsToCSV(
        draftRecipients.map((r) => ({
          ...r,
          verification: normalizeVerificationForSdp(r.verification ?? "") ?? "",
        })),
        defaultAmount
      );
      return new File([csvString], "disbursement.csv", { type: "text/csv" });
    };

    if (inputMode === "manual") {
      if (draftRecipients.length === 0) {
        setCreateError(t("errorNoRecipients"));
        return;
      }
      const built = buildCsvFile();
      if (!built) return;
      fileToUpload = built;
    } else {
      if (!csvFile || draftRecipients.length === 0) {
        setCreateError(t("errorNoRecipients"));
        return;
      }
      const built = buildCsvFile();
      if (!built) return;
      fileToUpload = built;
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

  // ── Distribuir (passkey Soroban payout) / Auto liberación ─────────────────

  async function beginDistribuir(disbursementId: string, batchName: string) {
    if (!kitReady || !kit) {
      setActionMsg(t("distributionTreasury.kitNotReady"));
      return;
    }

    setDistributingId(disbursementId);
    setActionMsg(null);
    setPayoutModalError(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${disbursementId}/payable`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error ? `Error: ${data.error}` : `Error: ${res.status}`);
        return;
      }
      const items = (data.payable ?? []) as PayableDisbursementItem[];
      if (items.length === 0) {
        setActionMsg(t("distributeNothingPayable"));
        return;
      }
      setDistribuirContext({
        disbursementId,
        batchName,
        items,
        totalAmount: String(data.totalAmount ?? items[0]?.amount ?? "0"),
      });
      setPayoutModalStatus("confirm");
      setPayoutModalSuccess(null);
      setPayoutModalOpen(true);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setDistributingId(null);
    }
  }

  async function confirmDistribuir() {
    if (!distribuirContext || !kit) return;

    setPayoutModalStatus("submitting");
    setPayoutModalError(null);
    const { disbursementId, items } = distribuirContext;
    const txHashes: string[] = [];

    try {
      for (const item of items) {
        const payoutId = `sdp-${disbursementId}-${item.paymentId}`;
        const result = await executePasskeySorobanPayout({
          kit,
          credentialId,
          payoutId,
          recipientAddress: item.recipientAddress,
          amount: item.amount,
          recipientLabel: item.recipientLabel,
        });

        const recordRes = await fetch(`/api/sdp/disbursements/${disbursementId}/record-payment`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: item.paymentId,
            txHash: result.stellarTxHash,
            amount: item.amount,
            recipientAddress: item.recipientAddress,
            recipientLabel: item.recipientLabel,
          }),
        });
        if (!recordRes.ok) {
          const recordData = await recordRes.json().catch(() => ({}));
          throw new Error(recordData.error ?? "Failed to record payment.");
        }
        txHashes.push(result.stellarTxHash);
      }

      const successPayload: PayoutModalSuccess =
        items.length === 1
          ? {
              amount: items[0]!.amount,
              recipientLabel: items[0]!.recipientLabel,
              destination: items[0]!.recipientAddress,
              stellarTxHash: txHashes[0],
            }
          : {
              amount: distribuirContext.totalAmount,
              batchCount: items.length,
              stellarTxHash: txHashes[txHashes.length - 1],
            };

      setPayoutModalStatus("success");
      setPayoutModalSuccess(successPayload);
      setActionMsg(
        items.length === 1
          ? t("distributePaidOne", { hash: txHashes[0]!.slice(0, 12) })
          : t("distributePaidMany", { count: items.length })
      );
      await fetchList();
      if (selectedId === disbursementId) await refreshDetail(disbursementId);
    } catch (e) {
      setPayoutModalStatus("failed");
      setPayoutModalError(e instanceof Error ? e.message : t("distributeFailed"));
    }
  }

  function handleAutoReleaseToggle(id: string, currentlyActive: boolean) {
    if (currentlyActive) {
      void disableAutoRelease(id);
      return;
    }
    setActionMsg(null);
    setAutoReleaseAuthorizeId(id);
  }

  async function disableAutoRelease(id: string) {
    setTogglingAutoId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/auto-release`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error ? `Error: ${data.error}` : `Error: ${res.status}`);
        return;
      }
      setActionMsg(t("autoReleaseDisabled"));
      await fetchList();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setTogglingAutoId(null);
    }
  }

  async function completeAutoRelease(id: string, auth: DisbursementAuthorizeResult) {
    setCommittingId(id);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/commit`, {
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
        setActionMsg(data.error ? `Error: ${data.error}` : `Error: ${res.status}`);
        setAutoReleaseAuthorizeId(null);
        return;
      }
      setAutoReleaseAuthorizeId(null);
      setActionMsg(t("autoReleaseSuccess"));
      await fetchList();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setCommittingId(null);
    }
  }

  async function handleToggleCampaign(id: string, currentStatus: string) {
    const next = currentStatus === "STARTED" ? "PAUSED" : "STARTED";
    if (currentStatus !== "STARTED" && currentStatus !== "PAUSED") return;

    setTogglingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error ? `Error: ${data.error}` : `Error: ${res.status}`);
        return;
      }
      setActionMsg(next === "PAUSED" ? t("campaignPaused") : t("campaignResumed"));
      await fetchList();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleFundBatch(id: string, amount: number) {
    if (!kitReady || !kit) {
      setActionMsg(t("distributionTreasury.kitNotReady"));
      return;
    }
    if (amount <= 0) {
      setActionMsg(t("batchAlreadyFunded"));
      return;
    }

    setFundingId(id);
    setActionMsg(null);
    try {
      const result = await executePasskeyDistributionTransfer({
        kit,
        direction: "to_distribution",
        amount: formatBatchAmount(amount),
      });
      setActionMsg(t("fundBatchSuccess", { amount: result.amount, hash: result.stellarTxHash.slice(0, 12) }));
      const balRes = await fetch("/api/treasury/distribution/balances", { credentials: "include" });
      if (balRes.ok) {
        const bal = (await balRes.json()) as { distributionUsdc?: string; configured?: boolean };
        if (bal.distributionUsdc) setDistributionUsdc(bal.distributionUsdc);
        if (bal.configured != null) setDistributionConfigured(bal.configured);
      }
      await fetchList();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : t("distributionTreasury.transferFailed"));
    } finally {
      setFundingId(null);
    }
  }

  async function handleSendInvites(id: string) {
    setSendingId(id);
    setActionMsg(null);
    try {
      const orgName = profile?.org_name?.trim();
      const res = await fetch(`/api/sdp/disbursements/${id}/send-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgName ? { organizationName: orgName } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
        return;
      }
      setActionMsg(
        data.campaignStarted
          ? t("invitesSentAndStarted", { sent: data.sent, skipped: data.skipped, failed: data.failed })
          : t("invitesSent", { sent: data.sent, skipped: data.skipped, failed: data.failed })
      );
      await fetchList();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setSendingId(null);
    }
  }

  // ── Delete batch (admin only; DRAFT / READY / PAUSED) ─────────────────────

  async function handleDelete(id: string, name: string) {
    if (!isDisbursementAdmin) return;
    if (!window.confirm(t("deleteArchiveConfirm", { name }))) return;

    setDeletingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {showCreate ? (
              t("cancel")
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t("newBatch")}
              </>
            )}
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

      {isDisbursementAdmin ? (
        <DistributionTreasuryPanel
          onBalancesChange={(b) => {
            setDistributionUsdc(b.distributionUsdc);
            setDistributionConfigured(b.configured);
          }}
        />
      ) : null}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("createTitle")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 -mt-4">
            {t("draftHint")}
          </p>

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
                        type="text"
                        inputMode="numeric"
                        placeholder={t("verificationPlaceholder")}
                        value={recipientForm.verification}
                        onChange={(e) => setField("verification", e.target.value)}
                        onBlur={(e) => {
                          const n = normalizeVerificationForSdp(e.target.value);
                          if (n && n !== e.target.value.trim()) setField("verification", n);
                        }}
                        onKeyDown={handleRecipientKeyDown}
                        className="w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {t("verificationHint")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    disabled={
                      !recipientForm.name.trim() ||
                      !recipientForm.email.trim() ||
                      !normalizeVerificationForSdp(recipientForm.verification)
                    }
                    className="mt-1 px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 transition-colors"
                  >
                    {t("addRecipient")}
                  </button>
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
                {draftRecipients.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("csvEditHint")}
                  </p>
                )}
              </div>
            )}

            {/* ── Draft recipient list (manual + CSV preview) ─────────────── */}
            {(inputMode === "manual" || draftRecipients.length > 0) && (
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
                            {t("colDob")}
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
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
                            key={`${r.email}-${i}`}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium max-w-[180px]">
                              <BeneficiaryFieldCell
                                value={r.name}
                                placeholder={t("namePlaceholder")}
                                onSave={(name) => updateDraftRecipient(i, { name })}
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[160px]">
                              {r.email}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400 hidden sm:table-cell max-w-[140px]">
                              <BeneficiaryFieldCell
                                value={r.verification}
                                placeholder={t("verificationPlaceholder")}
                                onSave={(verification) => {
                                  const normalized = normalizeVerificationForSdp(verification);
                                  if (!normalized) {
                                    setCreateError(t("errorInvalidVerification"));
                                    return;
                                  }
                                  setCreateError(null);
                                  updateDraftRecipient(i, { verification: normalized });
                                }}
                                className="font-normal text-gray-600 dark:text-gray-400"
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-500 hidden md:table-cell">
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
                {creating ? t("publishing") : t("publishBatch")}
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
              {listErrorCode === "NOT_ALLOWLISTED"
                ? t("profileNotActivatedTitle")
                : listErrorCode === "INSUFFICIENT_ROLE"
                  ? t("roleRequiredTitle")
                  : listErrorCode === "SESSION_EXPIRED"
                    ? t("sessionExpiredTitle")
                    : isSdpConfigError(listError ?? "")
                      ? t("sdpConfigTitle")
                      : t("sdpError")}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{listError}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              {listErrorCode === "NOT_ALLOWLISTED"
                ? t("profileNotActivatedHint")
                : listErrorCode === "INSUFFICIENT_ROLE"
                  ? t("roleRequiredHint")
                  : listErrorCode === "SESSION_EXPIRED"
                    ? t("sessionExpiredHint")
                    : listErrorCode === "SDP_NOT_CONFIGURED"
                      ? t("sdpEnvHint")
                      : null}
            </p>
          </div>
        )}
        {!listLoading && !listError && disbursements.length === 0 && !archivedBatchOpen && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>
        )}

        {archivedBatchOpen && detail?.disbursement ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 space-y-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">{t("archivedCampaignBanner")}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-white">{detail.disbursement.name}</p>
                  <DisbursementAuditButton
                    disbursementId={detail.disbursement.id}
                    disbursementName={detail.disbursement.name}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {detail.disbursement.total_payments} {t("payments")} ·{" "}
                  {formatDisbursementStatus(detail.disbursement.status, t)}
                </p>
              </div>
              <Link
                href="/dashboard/disbursements/history"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("viewHistory")}
              </Link>
            </div>
            {detail.payments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">{t("colRecipient")}</th>
                      <th className="px-3 py-2">{t("colAmount")}</th>
                      <th className="px-3 py-2">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2">{p.beneficiary_name || p.receiver.email || "—"}</td>
                        <td className="px-3 py-2">{p.amount}</td>
                        <td className="px-3 py-2">{formatPaymentStatus(p.payment_status, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {disbursements.map((d) => {
          const meta = metaById[d.id];
          const detailMeta =
            selectedId === d.id && detail?.disbursement.id === d.id
              ? (detail as { meta?: DisbursementMeta | null }).meta
              : null;
          const invitesSent = Boolean(meta?.invitesSentAt ?? detailMeta?.invitesSentAt);
          const hotlinkActive = Boolean(meta?.hotlinkAt ?? detailMeta?.hotlinkAt);
          const canEdit = DELETABLE_DISBURSEMENT_STATUSES.has(d.status);
          const batchRemaining = batchRemainingUsdc(d, meta);
          const batchFunded =
            batchRemaining <= 0 ||
            !distributionConfigured ||
            parseFloat(distributionUsdc) >= batchRemaining;
          const hasOutstandingPayments =
            d.status !== "COMPLETED" &&
            (d.successful_payments < d.total_payments ||
              d.failed_payments > 0 ||
              (selectedId === d.id &&
                detail?.disbursement.id === d.id &&
                detail.payments.some((p) => {
                  const status = p.payment_status.toUpperCase();
                  return status !== "SUCCESS" && status !== "CANCELED";
                })));
          const showDistribuir =
            isDisbursementAdmin &&
            invitesSent &&
            hasOutstandingPayments &&
            d.status !== "COMPLETED" &&
            (d.status === "DRAFT" ||
              d.status === "READY" ||
              d.status === "STARTED" ||
              d.status === "PAUSED");
          const showAutoReleaseToggle =
            isDisbursementAdmin && invitesSent && d.status !== "COMPLETED";
          const showDelete = isDisbursementAdmin && d.status !== "COMPLETED";

          return (
          <div
            key={d.id}
            className={`rounded-xl border cursor-pointer transition-colors ${
              selectedId === d.id
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
          >
            <div className="flex items-center justify-between px-5 py-4 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{d.name}</p>
                    <DisbursementAuditButton disbursementId={d.id} disbursementName={d.name} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {d.total_payments} {t("payments")} · {d.asset.code} · {d.wallet.name}
                    {invitesSent ? ` · ${t("campaignLive")}` : null}
                    {hotlinkActive ? ` · ${t("autoReleaseActive")}` : null}
                    {isDisbursementAdmin && batchRemaining > 0 ? (
                      batchFunded ? ` · ${t("batchFunded")}` : ` · ${t("batchNeedsFunding")}`
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isDisbursementAdmin && (d.status === "STARTED" || d.status === "PAUSED") ? (
                  <button
                    type="button"
                    title={d.status === "STARTED" ? t("pauseCampaign") : t("resumeCampaign")}
                    disabled={togglingId === d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleCampaign(d.id, d.status);
                    }}
                    className="p-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    {d.status === "STARTED" ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  title={t("refresh")}
                  disabled={detailLoading && selectedId === d.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void fetchList();
                    if (selectedId === d.id) void refreshDetail(d.id);
                  }}
                  className="p-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                {showDelete && (
                  <button
                    type="button"
                    title={t("deleteBatch")}
                    disabled={deletingId === d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(d.id, d.name);
                    }}
                    className="p-1.5 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[d.status] ?? STATUS_COLORS.DRAFT
                  }`}
                >
                  {formatDisbursementStatus(d.status, t)}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white hidden sm:inline">
                  {d.total_amount} {d.asset.code}
                </span>
                {showAutoReleaseToggle ? (
                  <label
                    className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none"
                    title={hotlinkActive ? t("autoReleaseActiveHint") : t("autoReleaseHint")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
                      {t("autoRelease")}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hotlinkActive}
                      aria-label={t("autoRelease")}
                      disabled={
                        togglingAutoId === d.id ||
                        committingId === d.id ||
                        (!hotlinkActive && !batchFunded && batchRemaining > 0)
                      }
                      onClick={() => handleAutoReleaseToggle(d.id, hotlinkActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 disabled:opacity-40 ${
                        hotlinkActive
                          ? "bg-amber-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          hotlinkActive ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                ) : null}
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
                <div className="flex flex-wrap items-center gap-2">
                  {isDisbursementAdmin ? (
                    <button
                      type="button"
                      onClick={() => void handleSendInvites(d.id)}
                      disabled={
                        sendingId === d.id ||
                        (!invitesSent && batchRemaining > 0 && !batchFunded)
                      }
                      title={
                        !invitesSent && batchRemaining > 0 && !batchFunded
                          ? t("sendInvitesNeedsFunding", {
                              amount: formatBatchAmount(batchRemaining),
                              asset: d.asset.code,
                            })
                          : undefined
                      }
                      className={`${CARD_ACTION_BTN} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40`}
                    >
                      {sendingId === d.id ? t("sending") : t("sendInvites")}
                    </button>
                  ) : null}
                  {isDisbursementAdmin && batchRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleFundBatch(d.id, batchRemaining)}
                      disabled={fundingId === d.id || !kitReady || !distributionConfigured}
                      title={
                        !distributionConfigured
                          ? t("distributionTreasury.notConfigured")
                          : t("fundBatchHint", {
                              amount: formatBatchAmount(batchRemaining),
                              asset: d.asset.code,
                            })
                      }
                      className={`${CARD_ACTION_BTN} bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40`}
                    >
                      {fundingId === d.id ? t("fundBatchSigning") : t("fundBatch")}
                    </button>
                  )}
                  {showDistribuir && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void beginDistribuir(d.id, d.name);
                      }}
                      disabled={distributingId === d.id || !kitReady || payoutModalOpen}
                      title={!invitesSent ? t("startPaymentsDisabledHint") : undefined}
                      className={`${CARD_ACTION_BTN} bg-green-600 text-white hover:bg-green-700 disabled:opacity-40`}
                    >
                      {distributingId === d.id ? t("starting") : t("startPayments")}
                    </button>
                  )}
                  {canEdit && detail?.disbursement.id === d.id && detail.receivers && (
                    <EditDisbursementRecipients
                      disbursementId={d.id}
                      receivers={detail.receivers}
                      uploadedVerificationByEmail={detail.uploadedVerificationByEmail}
                      onSaved={() => void refreshDetail(d.id)}
                    />
                  )}
                </div>
                {!batchFunded && batchRemaining > 0 && isDisbursementAdmin ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t("fundBatchHint")}</p>
                ) : null}
                {!invitesSent && (d.status === "READY" || d.status === "DRAFT") ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{t("sendInvitesHint")}</p>
                ) : null}

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
                    {(() => {
                      const canEditRecipients = EDITABLE_RECIPIENT_STATUSES.has(d.status);
                      return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colName")}
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {t("colDob")}
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {t("colSozuTag")}
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colAmount")}
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            {t("colLifecycleState")}
                          </th>
                          <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">
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
                            <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium max-w-[200px]">
                              <BeneficiaryFieldCell
                                value={p.legal_name}
                                placeholder={t("namePlaceholder")}
                                disabled={!canEditRecipients}
                                saving={savingBeneficiaryEmail === p.receiver.email}
                                onSave={(legalName) => {
                                  const email = p.receiver.email?.trim();
                                  if (!email) return;
                                  return saveBeneficiaryField(d.id, email, { legalName });
                                }}
                              />
                              {p.contact && p.contact !== p.beneficiary_name ? (
                                <div
                                  className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px] sm:max-w-[200px] mt-0.5"
                                  title={p.contact}
                                >
                                  {p.contact}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 hidden sm:table-cell whitespace-nowrap max-w-[160px]">
                              <BeneficiaryFieldCell
                                value={p.date_of_birth ?? ""}
                                placeholder={t("verificationPlaceholder")}
                                emptyLabel={t("dobEmptyLabel")}
                                disabled={!canEditRecipients}
                                disabledTitle={
                                  canEditRecipients ? undefined : t("dobEditDisabledHint")
                                }
                                saving={savingBeneficiaryEmail === p.receiver.email}
                                onSave={(dateOfBirth) => {
                                  const email = p.receiver.email?.trim();
                                  if (!email) return;
                                  return saveBeneficiaryField(d.id, email, { dateOfBirth });
                                }}
                                className="font-normal text-gray-600 dark:text-gray-400"
                              />
                              {p.date_of_birth && p.date_of_birth_source === "uploaded" ? (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                  {t("dobUploadedHint")}
                                </p>
                              ) : null}
                              {!p.date_of_birth && !canEditRecipients ? (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                  {t("dobUnknownAfterStart")}
                                </p>
                              ) : null}
                            </td>
                            <td
                              className="py-2 pr-4 text-gray-700 dark:text-gray-300 hidden md:table-cell font-mono text-xs"
                              title={t("sozuTagReadOnlyHint")}
                            >
                              {formatSozuTag(p.sozu_tag)}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-900 dark:text-white font-medium whitespace-nowrap">
                              {p.amount} {d.asset.code}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                                  LIFECYCLE_STATUS_COLORS[p.lifecycle_state] ??
                                  LIFECYCLE_STATUS_COLORS.draft
                                }`}
                              >
                                {t(`lifecycle.${p.lifecycle_state}`)}
                              </span>
                              {p.payment_status === "FAILED" ? (
                                <span
                                  className={`ml-1.5 text-xs font-medium ${
                                    PAYMENT_STATUS_COLORS.FAILED
                                  }`}
                                >
                                  ({t("paymentFailed")})
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 hidden lg:table-cell">
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
                              colSpan={6}
                              className="py-4 text-center text-sm text-gray-400"
                            >
                              {t("noPayments")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-center">
        <Link
          href="/dashboard/disbursements/history"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline-offset-2 hover:underline"
        >
          {t("viewHistory")}
        </Link>
      </div>

      <PayoutStatusModal
        open={payoutModalOpen}
        onClose={() => {
          setPayoutModalOpen(false);
          setDistribuirContext(null);
          setPayoutModalSuccess(null);
          setPayoutModalError(null);
          setPayoutModalStatus("confirm");
        }}
        status={payoutModalStatus}
        userName={profile?.username ?? undefined}
        payoutSummary={
          distribuirContext
            ? distribuirContext.items.length === 1
              ? {
                  amount: distribuirContext.items[0]!.amount,
                  recipientLabel: distribuirContext.items[0]!.recipientLabel,
                  destination: distribuirContext.items[0]!.recipientAddress,
                }
              : { amount: distribuirContext.totalAmount }
            : undefined
        }
        batchCount={
          distribuirContext && distribuirContext.items.length > 1
            ? distribuirContext.items.length
            : undefined
        }
        successData={payoutModalSuccess}
        errorMessage={payoutModalError}
        onConfirm={payoutModalStatus === "confirm" ? () => void confirmDistribuir() : undefined}
      />

      {autoReleaseAuthorizeId && (
        <DisbursementAuthorizeModal
          open
          disbursementId={autoReleaseAuthorizeId}
          onClose={() => setAutoReleaseAuthorizeId(null)}
          onAuthorized={(auth) => completeAutoRelease(autoReleaseAuthorizeId, auth)}
        />
      )}
    </div>
  );
}
