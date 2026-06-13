"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import PayoutStatusModal, { type PayoutModalSuccess } from "@/components/PayoutStatusModal";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { executePasskeySorobanPayout } from "@/lib/stellar/smartAccounts/signSorobanPayout";

const STELLAR_EXPERT_BASE =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

interface Recipient {
  id: string;
  name: string;
  bankAccountId: string;
  stellarAddress?: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt?: string;
}


export default function RecipientsPage() {
  const t = useTranslations("recipientsPage");
  const tc = useTranslations("common");
  const tp = useTranslations("payoutsPage");
  const { kit, credentialId } = useSmartAccountKitContext();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [bankCurrency, setBankCurrency] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingCode, setBankRoutingCode] = useState("");
  const [showPayMultiple, setShowPayMultiple] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountPerRecipient, setAmountPerRecipient] = useState<Record<string, string>>({});
  const [batchAmount, setBatchAmount] = useState("");
  const [payMultipleSubmitting, setPayMultipleSubmitting] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string>("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlockSecretKey, setUnlockSecretKey] = useState("");
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [pendingPayoutBody, setPendingPayoutBody] = useState<Record<string, unknown> | null>(null);
  const [payoutWalletAddress, setPayoutWalletAddress] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<{ amount: string; stellarTxHash?: string; recipientLabel?: string } | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutModalStatus, setPayoutModalStatus] = useState<"confirm" | "submitting" | "success" | "failed">("confirm");
  const [payoutModalSummary, setPayoutModalSummary] = useState<{ amount: string; destination?: string; recipientLabel?: string } | null>(null);
  const [payoutModalSuccess, setPayoutModalSuccess] = useState<PayoutModalSuccess | null>(null);
  const [payoutModalError, setPayoutModalError] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [payoutModalBatchCount, setPayoutModalBatchCount] = useState<number | null>(null);
  const [pendingConfirmBody, setPendingConfirmBody] = useState<Record<string, unknown> | null>(null);
  const [pendingBatchBody, setPendingBatchBody] = useState<Record<string, unknown> | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<Recipient | null>(null);
  const [showPayoutPasswordModal, setShowPayoutPasswordModal] = useState(false);
  const [payoutPasswordValue, setPayoutPasswordValue] = useState("");
  const [payoutPasswordSubmitting, setPayoutPasswordSubmitting] = useState(false);
  const [payoutPasswordError, setPayoutPasswordError] = useState<string | null>(null);
  const [pendingPayoutPasswordData, setPendingPayoutPasswordData] = useState<{
    payoutId: string;
    unsignedEnvelopeXdr: string;
    network: string;
    amount: string;
    destination: string;
    recipientLabel?: string;
  } | null>(null);
  const [isStore, setIsStore] = useState(false);

  function copyStellarToClipboard(recipientId: string, address: string) {
    navigator.clipboard.writeText(address).then(
      () => {
        setCopiedId(recipientId);
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => alert(t("copyFailed"))
    );
  }

  function load() {
    setLoading(true);
    fetch("/api/recipients")
      .then((r) => (r.ok ? r.json() : { recipients: [] }))
      .then((r) => {
        setRecipients(r.recipients ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: { admin_level?: string; org_payout_wallet_public_key?: string | null; org_stellar_disbursement_public_key?: string | null; email?: string; org_type?: string }) => {
        setAdminLevel(p.admin_level ?? "");
        setPayoutWalletAddress(p.org_payout_wallet_public_key ?? p.org_stellar_disbursement_public_key ?? null);
        setUserDisplayName(p.email?.split("@")[0] ?? tc("you"));
        setIsStore(p.org_type === "store");
      });
  }, []);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert(t("nameRequired"));
      return;
    }
    if (!dateOfBirth.trim()) {
      alert(t("dobRequired"));
      return;
    }
    fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim() || undefined,
        ...(isStore && {
          bankHolder: bankHolder.trim() || undefined,
          bankCountry: bankCountry.trim() || undefined,
          bankCurrency: bankCurrency.trim() || undefined,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          bankRoutingCode: bankRoutingCode.trim() || undefined,
        }),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          alert(d.error);
          return;
        }
        setShowAdd(false);
        setName("");
        setDateOfBirth("");
        setPhone("");
        setBankHolder("");
        setBankCountry("");
        setBankCurrency("");
        setBankAccountNumber("");
        setBankRoutingCode("");
        load();
      })
      .catch(() => alert(t("addFailed")));
  }

  function submitPayoutBody(body: Record<string, unknown>) {
    return fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      let data: Record<string, unknown> = {};
      try {
        const text = await r.text();
        if (text) data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = { error: r.statusText || "Request failed" };
      }
      return { ok: r.ok, status: r.status, data };
    });
  }

  function handlePayout(recipient: Recipient) {
    const amount = prompt(t("promptAmount"));
    if (!amount) return;
    const isStellar = !!recipient.stellarAddress && !recipient.bankAccountId;
    const body = isStellar
      ? { amount, toStellar: true, destination: recipient.stellarAddress, recipientLabel: recipient.name }
      : { amount, bankAccountId: recipient.bankAccountId, recipientLabel: recipient.name };
    setPayoutModalSummary({
      amount,
      destination: recipient.stellarAddress,
      recipientLabel: recipient.name,
    });
    setPayoutModalSuccess(null);
    setPayoutModalError(null);
    setPayoutModalBatchCount(null);
    setPendingConfirmBody(body);
    setPendingBatchBody(null);
    setPendingRecipient(recipient);
    setPayoutModalStatus("confirm");
    setPayoutModalOpen(true);
  }

  function handleConfirmDisbursement() {
    if (pendingBatchBody) {
      setPayoutModalStatus("submitting");
      setPayMultipleSubmitting(true);
      const body = pendingBatchBody;
      const count = (body.payouts as unknown[])?.length ?? 0;
      setPendingBatchBody(null);
      setPendingRecipient(null);
      submitPayoutBody(body)
        .then(({ ok, data }) => {
          if (data.requireUnlock && data.error) {
            setPayoutModalOpen(false);
            setPayoutModalBatchCount(null);
            setPendingPayoutBody(body);
            setShowUnlockModal(true);
            return;
          }
          if (!ok) {
            const msg = [data?.error, data.required ? t("twoFaLarge") : null]
              .filter(Boolean)
              .join(" ") || tc("requestFailed");
            setPayoutModalStatus("failed");
            setPayoutModalError(msg);
            return;
          }
          setPayoutModalStatus("success");
          setPayoutModalSuccess({ amount: "", batchCount: count });
          setShowPayMultiple(false);
          setSelectedIds(new Set());
          setAmountPerRecipient({});
          setBatchAmount("");
        })
        .catch((err) => {
          setPayoutModalStatus("failed");
          setPayoutModalError(err instanceof Error ? err.message : t("batchPayoutRequestFailed"));
        })
        .finally(() => setPayMultipleSubmitting(false));
      return;
    }
    if (pendingConfirmBody && pendingRecipient) {
      setPayoutModalStatus("submitting");
      const body = pendingConfirmBody;
      const recipient = pendingRecipient;
      setPendingConfirmBody(null);
      setPendingRecipient(null);
      submitPayoutBody(body)
        .then(async ({ ok, data: d }) => {
          const data = d as {
            payout?: { amount?: string; stellarTxHash?: string; stellarAddress?: string; recipientLabel?: string };
            error?: string;
            requireUnlock?: boolean;
            requirePayoutPassword?: boolean;
            requirePasskeySign?: boolean;
            unsignedEnvelopeXdr?: string;
            payoutId?: string;
            network?: string;
            amount?: string;
            destination?: string;
            recipientLabel?: string;
            required?: boolean;
          };
          const bodyAmount = typeof body.amount === "string" ? body.amount : "";
          const bodyRecipientLabel =
            typeof body.recipientLabel === "string" ? body.recipientLabel : recipient.name;
          if (data.requirePasskeySign && data.payoutId && data.destination) {
            if (!kit) {
              setPayoutModalStatus("failed");
              setPayoutModalError(tp("passkeyKitNotReady"));
              return;
            }
            try {
              const result = await executePasskeySorobanPayout({
                kit,
                credentialId,
                payoutId: String(data.payoutId),
                recipientAddress: String(data.destination),
                amount: String(data.amount ?? bodyAmount),
                recipientLabel: data.recipientLabel ?? bodyRecipientLabel,
              });
              const successPayload = {
                amount: result.payout.amount ?? bodyAmount,
                stellarTxHash: result.stellarTxHash,
                recipientLabel: result.payout.recipientLabel ?? recipient.name,
                destination: result.payout.stellarAddress ?? recipient.stellarAddress,
              };
              setPayoutModalStatus("success");
              setPayoutModalSuccess(successPayload);
              setPayoutSuccess(successPayload);
            } catch (err) {
              setPayoutModalStatus("failed");
              setPayoutModalError(err instanceof Error ? err.message : t("payoutRequestFailed"));
            }
            return;
          }
          if (data.requirePayoutPassword && data.unsignedEnvelopeXdr && data.payoutId) {
            setPayoutModalOpen(false);
            setPendingConfirmBody(null);
            setPendingRecipient(null);
            setPendingPayoutPasswordData({
              payoutId: String(data.payoutId),
              unsignedEnvelopeXdr: String(data.unsignedEnvelopeXdr),
              network: String(data.network ?? "testnet"),
              amount: String(data.amount ?? bodyAmount),
              destination: String(data.destination ?? recipient.stellarAddress),
              recipientLabel: String(data.recipientLabel ?? recipient.name),
            });
            setPayoutPasswordValue("");
            setPayoutPasswordError(null);
            setShowPayoutPasswordModal(true);
            return;
          }
          if (data.requireUnlock && data.error) {
            setPayoutModalOpen(false);
            setPendingPayoutBody(body);
            setShowUnlockModal(true);
            return;
          }
          if (!ok) {
            const msg = [data?.error, data.required ? t("twoFaLarge") : null]
              .filter(Boolean)
              .join(" ") || t("payoutRequestFailed");
            setPayoutModalStatus("failed");
            setPayoutModalError(msg);
            return;
          }
          const p = data?.payout as { amount?: string; stellarTxHash?: string; recipientLabel?: string; stellarAddress?: string } | undefined;
          const successPayload = {
            amount: p?.amount ?? bodyAmount,
            stellarTxHash: p?.stellarTxHash,
            recipientLabel: p?.recipientLabel ?? recipient.name,
            destination: p?.stellarAddress ?? recipient.stellarAddress,
          };
          setPayoutModalStatus("success");
          setPayoutModalSuccess(successPayload);
          setPayoutSuccess(successPayload);
        })
        .catch((err) => {
          setPayoutModalStatus("failed");
          setPayoutModalError(err instanceof Error ? err.message : t("payoutRequestFailed"));
        });
    }
  }

  async function handlePayoutPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = pendingPayoutPasswordData;
    if (!data || !payoutPasswordValue.trim()) return;
    setPayoutPasswordSubmitting(true);
    setPayoutPasswordError(null);
    try {
      const encRes = await fetch("/api/profile/org/encrypted-secret");
      const encJson = await encRes.json().catch(() => ({}));
      if (!encRes.ok || !encJson.encryptedSecret) {
        setPayoutPasswordError(encJson.error ?? tc("requestFailed"));
        return;
      }
      const { decryptOrgSecretClient } = await import("@/lib/org-wallet-client-crypto");
      const { Keypair, Transaction, Networks } = await import("@stellar/stellar-sdk");
      const secretKey = await decryptOrgSecretClient(encJson.encryptedSecret, payoutPasswordValue.trim());
      const keypair = Keypair.fromSecret(secretKey);
      const networkPassphrase = data.network === "public" ? Networks.PUBLIC : Networks.TESTNET;
      const tx = new Transaction(data.unsignedEnvelopeXdr, networkPassphrase);
      tx.sign(keypair);
      const signedEnvelopeXdr = tx.toEnvelope().toXDR("base64");
      const submitRes = await fetch("/api/payouts/submit-signed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedEnvelopeXdr, payoutId: data.payoutId }),
      });
      const submitJson = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        setPayoutPasswordError((submitJson.error as string) ?? tp("alertPayoutFailed"));
        return;
      }
      setShowPayoutPasswordModal(false);
      setPendingPayoutPasswordData(null);
      setPayoutPasswordValue("");
      const p = submitJson.payout as { amount?: string; stellarTxHash?: string; recipientLabel?: string; stellarAddress?: string };
      setPayoutModalStatus("success");
      setPayoutModalSuccess({
        amount: p?.amount ?? data.amount,
        stellarTxHash: p?.stellarTxHash,
        recipientLabel: p?.recipientLabel ?? data.recipientLabel,
        destination: p?.stellarAddress ?? data.destination,
      });
      setPayoutModalOpen(true);
      setPayoutSuccess({
        amount: data.amount,
        stellarTxHash: p?.stellarTxHash,
        recipientLabel: data.recipientLabel,
      });
    } catch (err) {
      setPayoutPasswordError(err instanceof Error ? err.message : tp("alertPayoutFailed"));
    } finally {
      setPayoutPasswordSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    fetch(`/api/recipients/${id}`, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { alert(d?.error ?? t("failedToDelete")); });
        setExpandedId((current) => (current === id ? null : current));
        load();
      })
      .catch(() => alert(t("failedDeleteRecipient")))
      .finally(() => setDeletingId(null));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePayMultiple(e: React.FormEvent) {
    e.preventDefault();
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert(t("selectOneRecipient"));
      return;
    }
    const useSameAmount = batchAmount.trim() !== "";
    const payouts: { recipientId: string; amount: string }[] = [];
    for (const rid of ids) {
      const amount = useSameAmount ? batchAmount.trim() : (amountPerRecipient[rid] ?? "").trim();
      if (!amount || parseFloat(amount) <= 0) {
        alert(t("validAmount", { name: recipients.find((r) => r.id === rid)?.name ?? rid }));
        return;
      }
      payouts.push({ recipientId: rid, amount });
    }
    const body = { payouts };
    setPayoutModalSummary(null);
    setPayoutModalSuccess(null);
    setPayoutModalError(null);
    setPayoutModalBatchCount(payouts.length);
    setPendingBatchBody(body);
    setPendingConfirmBody(null);
    setPendingRecipient(null);
    setPayoutModalStatus("confirm");
    setPayoutModalOpen(true);
  }

  function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passphrase = unlockPassphrase.trim();
    const secretKey = unlockSecretKey.trim();
    if ((!passphrase && !secretKey) || !pendingPayoutBody) return;
    setUnlockSubmitting(true);
    const body = secretKey
      ? { secretKey }
      : { passphrase };
    fetch("/api/auth/unlock-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          alert(d.error);
          setUnlockSubmitting(false);
          return;
        }
        return submitPayoutBody(pendingPayoutBody);
      })
      .then((result) => {
        if (!result) return;
        setShowUnlockModal(false);
        setUnlockPassphrase("");
        setUnlockSecretKey("");
        if (result.ok) {
          const count = (pendingPayoutBody as { payouts?: unknown[] })?.payouts?.length ?? 0;
          setPayoutModalStatus("success");
          setPayoutModalSuccess({ amount: "", batchCount: count });
          setPayoutModalOpen(true);
          setPendingPayoutBody(null);
          setShowPayMultiple(false);
          setSelectedIds(new Set());
          setAmountPerRecipient({});
          setBatchAmount("");
        } else {
          setPayoutModalOpen(true);
          setPayoutModalStatus("failed");
          setPayoutModalError((result.data?.error as string) ?? tp("alertPayoutFailed"));
          setPendingPayoutBody(null);
        }
      })
      .catch((err) => alert(err instanceof Error ? err.message : t("unlockOrPayoutFailed")))
      .finally(() => setUnlockSubmitting(false));
  }

  return (
    <div>
      <PayoutStatusModal
        open={payoutModalOpen}
        onClose={() => {
          setPayoutModalOpen(false);
          setPayoutModalSummary(null);
          setPayoutModalSuccess(null);
          setPayoutModalError(null);
          setPayoutModalBatchCount(null);
          setPendingConfirmBody(null);
          setPendingBatchBody(null);
          setPendingRecipient(null);
        }}
        status={payoutModalStatus}
        userName={userDisplayName}
        payoutSummary={payoutModalSummary ?? undefined}
        successData={payoutModalSuccess}
        errorMessage={payoutModalError}
        batchCount={payoutModalBatchCount ?? undefined}
        onConfirm={payoutModalStatus === "confirm" ? handleConfirmDisbursement : undefined}
      />

      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {payoutSuccess && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start justify-between gap-4"
        >
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">{t("payoutSent")}</p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {t("sentLine", {
                amount: payoutSuccess.amount,
                to: payoutSuccess.recipientLabel ? t("toRecipient", { name: payoutSuccess.recipientLabel }) : "",
              })}
            </p>
            {payoutSuccess.stellarTxHash ? (
              <a
                href={`${STELLAR_EXPERT_BASE}/tx/${payoutSuccess.stellarTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
              >
                {t("viewExpert")}
              </a>
            ) : null}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/dashboard/payouts"
              className="rounded-md bg-green-700 dark:bg-green-600 text-white px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              {t("payoutHistory")}
            </Link>
            <button
              type="button"
              onClick={() => setPayoutSuccess(null)}
              className="rounded p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40"
              aria-label={tc("dismiss")}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-6 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium"
        >
          {t("addRecipient")}
        </button>
      ) : (
        <form onSubmit={handleAdd} className="mt-6 max-w-md space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <label className="block text-sm font-medium">{t("fullNameLabel")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="recipient-dob" className="block text-sm font-medium">{t("dobLabel")}</label>
            <input
              id="recipient-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("dobHint")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("phoneLabel")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>

          {isStore && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bank details (optional)</p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account holder</label>
                <input
                  type="text"
                  value={bankHolder}
                  onChange={(e) => setBankHolder(e.target.value)}
                  placeholder="Full name on bank account"
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                  <input
                    type="text"
                    value={bankCountry}
                    onChange={(e) => setBankCountry(e.target.value.toUpperCase())}
                    placeholder="US, MX…"
                    maxLength={2}
                    className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <input
                    type="text"
                    value={bankCurrency}
                    onChange={(e) => setBankCurrency(e.target.value.toUpperCase())}
                    placeholder="USD…"
                    maxLength={3}
                    className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account number / IBAN</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Account number or IBAN"
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Routing / sort / CLABE (optional)</label>
                <input
                  type="text"
                  value={bankRoutingCode}
                  onChange={(e) => setBankRoutingCode(e.target.value)}
                  placeholder="Routing number or sort code"
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2">
              {t("add")}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2">
              {tc("cancel")}
            </button>
          </div>
        </form>
      )}

      <h2 className="mt-8 text-lg font-semibold">{t("listTitle")}</h2>
      {loading ? (
        <div className="mt-4 animate-pulse h-24 rounded-lg border border-gray-200 dark:border-gray-700" />
      ) : recipients.length === 0 ? (
        <p className="mt-4 text-gray-500 dark:text-gray-400">{t("noRecipients")}</p>
      ) : (
        <>
          {!showPayMultiple ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowPayMultiple(true)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium"
              >
                {t("payMultiple")}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePayMultiple} className="mt-4 max-w-2xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <h3 className="font-medium">{t("selectAmountsTitle")}</h3>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">{t("sameAmountAll")}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={t("sameAmountPlaceholder")}
                  value={batchAmount}
                  onChange={(e) => setBatchAmount(e.target.value)}
                  className="w-full max-w-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("sameAmountHint")}</p>
              </div>
              <ul className="space-y-2">
                {recipients.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="font-medium">{r.name}</span>
                      {(r.stellarAddress || !r.bankAccountId) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {r.stellarAddress ? t("stellarBadge") : t("noBankBadge")}
                        </span>
                      )}
                    </label>
                    {selectedIds.has(r.id) && batchAmount.trim() === "" && (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={t("amountPlaceholder")}
                        value={amountPerRecipient[r.id] ?? ""}
                        onChange={(e) => setAmountPerRecipient((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
                      />
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={payMultipleSubmitting || selectedIds.size === 0}
                  className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium disabled:opacity-50"
                >
                  {payMultipleSubmitting ? t("sending") : t("paySelected")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPayMultiple(false);
                    setSelectedIds(new Set());
                    setAmountPerRecipient({});
                    setBatchAmount("");
                  }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          )}
          <ul className="mt-4 space-y-2">
            {recipients.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-[height]"
                >
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 min-h-[3.5rem]">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0 rounded focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? t("collapseDetails") : t("expandDetails")}
                    >
                      <span
                        className={`inline-flex w-5 h-5 flex-shrink-0 items-center justify-center text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                      <span className="font-medium truncate">{r.name}</span>
                      {(r.stellarAddress || !r.bankAccountId) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {r.stellarAddress ? t("stellarBadge") : t("noBankBadge")}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePayout(r)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
                    >
                      {t("payNow")}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                        {r.stellarAddress && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-gray-500 dark:text-gray-500 shrink-0">{t("stellarBadge")}</span>
                            <button
                              type="button"
                              onClick={() => copyStellarToClipboard(r.id, r.stellarAddress!)}
                              className="text-xs font-mono truncate max-w-[12rem] sm:max-w-xs text-left hover:underline focus:ring-2 focus:ring-offset-1 rounded cursor-pointer"
                              title={t("clickToCopy")}
                            >
                              {r.stellarAddress}
                            </button>
                            {copiedId === r.id && (
                              <span className="text-xs text-green-600 dark:text-green-400 shrink-0">{t("copied")}</span>
                            )}
                          </div>
                        )}
                        {(r.phone ?? "").trim() && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-500 dark:text-gray-500 shrink-0">{t("phone")}</span>
                            <span>{r.phone}</span>
                          </div>
                        )}
                        {(r.dateOfBirth ?? "").trim() && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-500 dark:text-gray-500 shrink-0">{t("dob")}</span>
                            <span>{r.dateOfBirth}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-500 dark:text-gray-500 shrink-0">{t("bank")}</span>
                          <span>{r.bankAccountId ? t("bankLinked") : t("bankNone")}</span>
                        </div>
                        {r.createdAt && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-500 dark:text-gray-500 shrink-0">{t("added")}</span>
                            <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(t("confirmRemove", { name: r.name }))) handleDelete(r.id);
                            }}
                            disabled={deletingId === r.id}
                            className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                          >
                            {deletingId === r.id ? t("removing") : t("delete")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {t("footerNote")}
      </p>
      {adminLevel === "super_admin" && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t("superAdminNote")}
        </p>
      )}

      {showPayoutPasswordModal && pendingPayoutPasswordData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payout-password-title">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
            <h2 id="payout-password-title" className="text-lg font-semibold">{tp("payoutPasswordTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tp("payoutPasswordApprove", {
                amount: pendingPayoutPasswordData.amount,
                recipient: pendingPayoutPasswordData.recipientLabel
                  ? ` to ${pendingPayoutPasswordData.recipientLabel}`
                  : "",
                destination: pendingPayoutPasswordData.destination
                  ? ` (${pendingPayoutPasswordData.destination.slice(0, 6)}…${pendingPayoutPasswordData.destination.slice(-4)})`
                  : "",
              })}
            </p>
            <form onSubmit={handlePayoutPasswordSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="payout-password" className="block text-sm font-medium">{tp("payoutPasswordLabel")}</label>
                <input
                  id="payout-password"
                  type="password"
                  autoComplete="current-password"
                  value={payoutPasswordValue}
                  onChange={(e) => { setPayoutPasswordValue(e.target.value); setPayoutPasswordError(null); }}
                  placeholder={tp("payoutPasswordPlaceholder")}
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
              {payoutPasswordError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{payoutPasswordError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={payoutPasswordSubmitting || !payoutPasswordValue.trim()}
                  className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium disabled:opacity-50"
                >
                  {payoutPasswordSubmitting ? tp("signing") : tp("signAndSend")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPayoutPasswordModal(false);
                    setPendingPayoutPasswordData(null);
                    setPayoutPasswordValue("");
                    setPayoutPasswordError(null);
                  }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
            <h2 id="unlock-title" className="text-lg font-semibold">{tp("unlockTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tp("unlockBody")}
            </p>
            {payoutWalletAddress && (
              <p className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
                {tp("payoutWalletLabel")} {payoutWalletAddress}
              </p>
            )}
            <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="unlock-passphrase" className="block text-sm font-medium">{tp("passphraseLabel")}</label>
                <input
                  id="unlock-passphrase"
                  type="password"
                  autoComplete="current-password"
                  value={unlockPassphrase}
                  onChange={(e) => setUnlockPassphrase(e.target.value)}
                  placeholder={tp("passphrasePlaceholder")}
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
              <div className="relative">
                <span className="text-xs text-gray-500 dark:text-gray-400">{tc("or")}</span>
              </div>
              <div>
                <label htmlFor="unlock-secret" className="block text-sm font-medium">{tp("walletSecretLabel")}</label>
                <input
                  id="unlock-secret"
                  type="password"
                  autoComplete="off"
                  value={unlockSecretKey}
                  onChange={(e) => setUnlockSecretKey(e.target.value)}
                  placeholder="S..."
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={unlockSubmitting || (!unlockPassphrase.trim() && !unlockSecretKey.trim())}
                  className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium disabled:opacity-50"
                >
                  {unlockSubmitting ? tp("unlocking") : tp("unlockAndPay")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setPendingPayoutBody(null);
                    setUnlockPassphrase("");
                    setUnlockSecretKey("");
                  }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
