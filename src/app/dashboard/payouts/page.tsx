"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import SendUsdcForm, { type PayoutSuccess, type StellarPayoutBody } from "@/components/SendUsdcForm";
import PayoutStatusModal, { type PayoutModalSuccess } from "@/components/PayoutStatusModal";
import Link from "next/link";

interface Payout {
  id: string;
  amount: string;
  type: string;
  recipientLabel?: string;
  stellarTxHash?: string;
  status: string;
  createdAt: string;
}

interface Recipient {
  id: string;
  name: string;
  bankAccountId: string;
  stellarAddress?: string;
}

const STELLAR_EXPERT_BASE =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export default function PayoutsPage() {
  const t = useTranslations("payoutsPage");
  const tc = useTranslations("common");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; label: string; last4: string; isDefault: boolean }[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [batchRows, setBatchRows] = useState<{ recipientId: string; amount: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlockSecretKey, setUnlockSecretKey] = useState("");
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [pendingPayoutBody, setPendingPayoutBody] = useState<Record<string, unknown> | null>(null);
  const [payoutWalletAddress, setPayoutWalletAddress] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<PayoutSuccess | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutModalStatus, setPayoutModalStatus] = useState<"confirm" | "submitting" | "success" | "failed">("confirm");
  const [payoutModalSummary, setPayoutModalSummary] = useState<{ amount: string; destination?: string; recipientLabel?: string } | null>(null);
  const [payoutModalSuccess, setPayoutModalSuccess] = useState<PayoutModalSuccess | null>(null);
  const [payoutModalError, setPayoutModalError] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [payoutModalBatchCount, setPayoutModalBatchCount] = useState<number | null>(null);
  const [pendingConfirmBody, setPendingConfirmBody] = useState<StellarPayoutBody | null>(null);
  const [pendingBatchBody, setPendingBatchBody] = useState<Record<string, unknown> | null>(null);
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

  function loadPayouts() {
    fetch("/api/payouts")
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((d) => setPayouts(d.payouts ?? []));
  }

  useEffect(() => {
    fetch("/api/payouts")
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((d) => setPayouts(d.payouts ?? []))
      .finally(() => setLoading(false));
    fetch("/api/bank-accounts")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccounts(d.accounts ?? []));
    fetch("/api/recipients")
      .then((r) => (r.ok ? r.json() : { recipients: [] }))
      .then((d) => setRecipients(d.recipients ?? []));
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: { org_payout_wallet_public_key?: string | null; org_stellar_disbursement_public_key?: string | null; email?: string }) => {
        setPayoutWalletAddress(p.org_payout_wallet_public_key ?? p.org_stellar_disbursement_public_key ?? null);
        setUserDisplayName(p.email?.split("@")[0] ?? tc("you"));
      });
  }, []);

  useEffect(() => {
    if (showBatch && batchRows.length === 0 && recipients.length > 0) {
      setBatchRows(recipients.slice(0, 5).map((r) => ({ recipientId: r.id, amount: "" })));
    }
  }, [showBatch, recipients, batchRows.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        bankAccountId: bankAccountId || (accounts[0]?.id),
        twoFactorVerified: false,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          alert(String(d.error) + (d.required ? t("alert2fa") : ""));
          return;
        }
        setShowForm(false);
        setAmount("");
        loadPayouts();
      })
      .catch(() => alert(t("alertPayoutFailed")));
  }

  function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = batchRows.filter((row) => row.recipientId && parseFloat(row.amount) > 0);
    if (items.length === 0) {
      alert(t("alertBatchRecipients"));
      return;
    }
    const body = {
      payouts: items.map((row) => ({ recipientId: row.recipientId, amount: String(row.amount) })),
      twoFactorVerified: false,
    };
    setPayoutModalSummary(null);
    setPayoutModalSuccess(null);
    setPayoutModalError(null);
    setPayoutModalBatchCount(items.length);
    setPendingBatchBody(body);
    setPendingConfirmBody(null);
    setPayoutModalStatus("confirm");
    setPayoutModalOpen(true);
  }

  function handleConfirmDisbursement() {
    if (pendingBatchBody) {
      setPayoutModalStatus("submitting");
      setBatchSubmitting(true);
      const body = pendingBatchBody;
      setPendingBatchBody(null);
      submitPayoutBody(body)
        .then(({ ok, data: d }) => {
          if (d.requireUnlock && d.error) {
            setPayoutModalOpen(false);
            setPayoutModalBatchCount(null);
            setPendingPayoutBody(body);
            setShowUnlockModal(true);
            return;
          }
          if (!ok) {
            const msg = [d?.error, d.required ? t("twoFaLargePayout") : null]
              .filter(Boolean)
              .join(" ") || tc("requestFailed");
            setPayoutModalStatus("failed");
            setPayoutModalError(msg);
            return;
          }
          setPayoutModalStatus("success");
          setPayoutModalSuccess({ amount: "", batchCount: (body.payouts as unknown[])?.length ?? 0 });
          setShowBatch(false);
          setBatchRows([]);
          loadPayouts();
        })
        .catch((err) => {
          setPayoutModalStatus("failed");
          setPayoutModalError(err instanceof Error ? err.message : t("batchPayoutFailed"));
        })
        .finally(() => setBatchSubmitting(false));
      return;
    }
    if (pendingConfirmBody) {
      setPayoutModalStatus("submitting");
      const body = pendingConfirmBody;
      setPendingConfirmBody(null);
      submitPayoutBody(body)
        .then(({ ok, data: d }) => {
          const data = d as { payout?: { amount?: string; stellarTxHash?: string; stellarAddress?: string; recipientLabel?: string }; error?: string; requireUnlock?: boolean; requirePayoutPassword?: boolean; unsignedEnvelopeXdr?: string; payoutId?: string; network?: string; amount?: string; destination?: string; recipientLabel?: string };
          if (data.requirePayoutPassword && data.unsignedEnvelopeXdr && data.payoutId) {
            setPayoutModalOpen(false);
            setPendingConfirmBody(null);
            setPendingPayoutPasswordData({
              payoutId: String(data.payoutId),
              unsignedEnvelopeXdr: String(data.unsignedEnvelopeXdr),
              network: String(data.network ?? "testnet"),
              amount: String(data.amount ?? body.amount),
              destination: String(data.destination ?? body.destination),
              recipientLabel: data.recipientLabel ?? body.recipientLabel,
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
          if (ok && data.payout) {
            const p = data.payout;
            setPayoutModalStatus("success");
            setPayoutModalSuccess({
              amount: typeof p.amount === "string" ? p.amount : body.amount,
              destination: p.stellarAddress ?? body.destination,
              recipientLabel: p.recipientLabel,
              stellarTxHash: p.stellarTxHash,
            });
            setLastSuccess({ amount: body.amount, destination: body.destination, recipientLabel: body.recipientLabel, stellarTxHash: p.stellarTxHash });
            loadPayouts();
          } else {
            setPayoutModalStatus("failed");
            setPayoutModalError((data.error as string) ?? t("alertPayoutFailed"));
          }
        })
        .catch((err) => {
          setPayoutModalStatus("failed");
          setPayoutModalError(err instanceof Error ? err.message : t("alertPayoutFailed"));
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
        setPayoutPasswordError((submitJson.error as string) ?? t("alertPayoutFailed"));
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
      setLastSuccess({ amount: data.amount, destination: data.destination, recipientLabel: data.recipientLabel, stellarTxHash: p?.stellarTxHash });
      setPayoutModalOpen(true);
      loadPayouts();
    } catch (err) {
      setPayoutPasswordError(err instanceof Error ? err.message : t("alertPayoutFailed"));
    } finally {
      setPayoutPasswordSubmitting(false);
    }
  }

  function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passphrase = unlockPassphrase.trim();
    const secretKey = unlockSecretKey.trim();
    if ((!passphrase && !secretKey) || !pendingPayoutBody) return;
    setUnlockSubmitting(true);
    const body = secretKey ? { secretKey } : { passphrase };
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
          const payouts = (pendingPayoutBody as { payouts?: unknown[] })?.payouts;
          const isBatch = Array.isArray(payouts) && payouts.length > 0;
          if (isBatch) {
            setPayoutModalStatus("success");
            setPayoutModalSuccess({ amount: "", batchCount: payouts.length });
            setPayoutModalBatchCount(payouts.length);
            setPayoutModalOpen(true);
            setShowBatch(false);
            setBatchRows([]);
          }
          setPendingPayoutBody(null);
          loadPayouts();
        } else {
          setPayoutModalOpen(true);
          setPayoutModalStatus("failed");
          setPayoutModalError((result.data?.error as string) ?? t("alertPayoutFailed"));
          setPendingPayoutBody(null);
        }
      })
      .catch(() => alert(t("alertUnlockFailed")))
      .finally(() => setUnlockSubmitting(false));
  }

  function addBatchRow() {
    const next = recipients.find((r) => !batchRows.some((row) => row.recipientId === r.id));
    if (next) setBatchRows((prev) => [...prev, { recipientId: next.id, amount: "" }]);
  }

  function setBatchRowAmount(index: number, value: string) {
    setBatchRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], amount: value };
      return next;
    });
  }

  function setBatchRowRecipient(index: number, recipientId: string) {
    setBatchRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], recipientId };
      return next;
    });
  }

  function removeBatchRow(index: number) {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {accounts.length === 0 && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {t("addBankFirst")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={accounts.length === 0}
          className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium disabled:opacity-50"
        >
          {t("newPayout")}
        </button>
        <button
          type="button"
          onClick={() => setShowBatch(true)}
          disabled={recipients.length === 0}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium disabled:opacity-50"
        >
          {t("batchPayout")}
        </button>
      </div>

      {showBatch && (
        <form onSubmit={handleBatchSubmit} className="mt-6 max-w-2xl space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold">{t("batchTitle")}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("batchHelp")}
          </p>
          <div className="space-y-2">
            {batchRows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`${t("selectRecipient")} ${i + 1}`}
                  value={row.recipientId}
                  onChange={(e) => setBatchRowRecipient(i, e.target.value)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 min-w-[180px]"
                >
                  <option value="">{t("selectRecipient")}</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.stellarAddress && !r.bankAccountId ? t("stellarSuffix") : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={t("amountUsdc")}
                  aria-label={`${t("amountUsdc")} ${i + 1}`}
                  value={row.amount}
                  onChange={(e) => setBatchRowAmount(i, e.target.value)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 w-28"
                />
                <button type="button" onClick={() => removeBatchRow(i)} className="text-red-600 dark:text-red-400 text-sm">
                  {t("remove")}
                </button>
              </div>
            ))}
            {recipients.length > batchRows.length && (
              <button type="button" onClick={addBatchRow} className="text-sm text-blue-600 dark:text-blue-400">
                {t("addRecipient")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={batchSubmitting} className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2">
              {batchSubmitting ? t("submitting") : t("submitBatch")}
            </button>
            <button type="button" onClick={() => { setShowBatch(false); setBatchRows([]); }} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2">
              {tc("cancel")}
            </button>
          </div>
          {recipients.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <Link href="/dashboard/recipients" className="underline">{t("addRecipientsFirst")}</Link>{t("batchNeedRecipients")}
            </p>
          )}
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <label htmlFor="payout-amount" className="block text-sm font-medium">{t("amountLabel")}</label>
            <input
              id="payout-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="payout-bank-account" className="block text-sm font-medium">{t("bankAccount")}</label>
            <select
              id="payout-bank-account"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} (…{a.last4}) {a.isDefault ? t("defaultAccount") : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2">
              {t("submit")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2">
              {tc("cancel")}
            </button>
          </div>
        </form>
      )}

      {lastSuccess && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start justify-between gap-4"
        >
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              {t("payoutSent")}
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {t("sentTo", {
                amount: lastSuccess.amount,
                dest: lastSuccess.destination.slice(0, 8),
                tail: lastSuccess.destination.slice(-4),
                label: lastSuccess.recipientLabel ? ` (${lastSuccess.recipientLabel})` : "",
              })}
            </p>
            {lastSuccess.stellarTxHash && (
              <a
                href={`${STELLAR_EXPERT_BASE}/tx/${lastSuccess.stellarTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
              >
                {t("viewExpert")}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLastSuccess(null)}
            className="rounded p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40"
            aria-label={tc("dismiss")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("sendUsdcTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("sendUsdcSubtitle")}
        </p>
        <SendUsdcForm
          onSubmitting={(summary, body) => {
            setPayoutModalSummary(summary);
            setPayoutModalSuccess(null);
            setPayoutModalError(null);
            setPayoutModalBatchCount(null);
            setPendingConfirmBody(body);
            setPendingBatchBody(null);
            setPayoutModalStatus("confirm");
            setPayoutModalOpen(true);
          }}
          onSent={(payout) => {
            setPayoutModalStatus("success");
            setPayoutModalSuccess(payout);
            setLastSuccess(payout);
            loadPayouts();
          }}
          onFailed={(error) => {
            setPayoutModalStatus("failed");
            setPayoutModalError(error);
          }}
          onRequireUnlock={(body) => {
            setPayoutModalOpen(false);
            setPendingPayoutBody(body);
            setShowUnlockModal(true);
          }}
        />
      </section>

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
        }}
        status={payoutModalStatus}
        userName={userDisplayName}
        payoutSummary={payoutModalSummary ?? undefined}
        successData={payoutModalSuccess}
        errorMessage={payoutModalError}
        batchCount={payoutModalBatchCount ?? undefined}
        onConfirm={payoutModalStatus === "confirm" ? handleConfirmDisbursement : undefined}
      />

      {showPayoutPasswordModal && pendingPayoutPasswordData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payout-password-title">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
            <h2 id="payout-password-title" className="text-lg font-semibold">{t("payoutPasswordTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("payoutPasswordApprove", {
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
                <label htmlFor="payout-password" className="block text-sm font-medium">{t("payoutPasswordLabel")}</label>
                <input
                  id="payout-password"
                  type="password"
                  autoComplete="current-password"
                  value={payoutPasswordValue}
                  onChange={(e) => { setPayoutPasswordValue(e.target.value); setPayoutPasswordError(null); }}
                  placeholder={t("payoutPasswordPlaceholder")}
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
                  {payoutPasswordSubmitting ? t("signing") : t("signAndSend")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPayoutPasswordModal(false); setPendingPayoutPasswordData(null); setPayoutPasswordValue(""); setPayoutPasswordError(null); }}
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
            <h2 id="unlock-title" className="text-lg font-semibold">{t("unlockTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("unlockBody")}
            </p>
            {payoutWalletAddress && (
              <p className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-all">{t("payoutWalletLabel")} {payoutWalletAddress}</p>
            )}
            <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="unlock-passphrase" className="block text-sm font-medium">{t("passphraseLabel")}</label>
                <input
                  id="unlock-passphrase"
                  type="password"
                  autoComplete="current-password"
                  value={unlockPassphrase}
                  onChange={(e) => setUnlockPassphrase(e.target.value)}
                  placeholder={t("passphrasePlaceholder")}
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tc("or")}</p>
              <div>
                <label htmlFor="unlock-secret" className="block text-sm font-medium">{t("walletSecretLabel")}</label>
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
                  {unlockSubmitting ? t("unlocking") : t("unlockAndPay")}
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

      <h2 className="mt-8 text-lg font-semibold">{t("historyTitle")}</h2>
      {loading ? (
        <div className="mt-4 animate-pulse h-24 rounded-lg border border-gray-200 dark:border-gray-700" />
      ) : payouts.length === 0 ? (
        <p className="mt-4 text-gray-500 dark:text-gray-400">{t("noPayouts")}</p>
      ) : (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("colDate")}</th>
                <th className="text-left p-3 font-medium">{t("colAmount")}</th>
                <th className="text-left p-3 font-medium">{t("colType")}</th>
                <th className="text-left p-3 font-medium">{t("colStatus")}</th>
                <th className="text-left p-3 font-medium">{t("colExpert")}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="p-3">{p.amount} USDC</td>
                  <td className="p-3">{t("payoutType")}{p.recipientLabel ? ` – ${p.recipientLabel}` : ""}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">
                    {p.stellarTxHash ? (
                      <a
                        href={`${STELLAR_EXPERT_BASE}/tx/${p.stellarTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t("view")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
