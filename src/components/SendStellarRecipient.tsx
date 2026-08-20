"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SendUsdcForm, { type PayoutSuccess, type StellarPayoutBody } from "@/components/SendUsdcForm";
import PayoutStatusModal, { type PayoutModalSuccess } from "@/components/PayoutStatusModal";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { executePasskeySorobanPayout } from "@/lib/stellar/smartAccounts/signSorobanPayout";
import {
  executeAndCompletePollarClientPayout,
  isPollarClientTxChallenge,
} from "@/lib/pollar/complete-client-payout";

const STELLAR_EXPERT_BASE =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

type RecentSend = {
  id: string;
  amount: string;
  asset?: string;
  recipientLabel?: string;
  stellarAddress?: string;
  stellarTxHash?: string;
  status: string;
  createdAt: string;
  type?: string;
};

export default function SendStellarRecipient() {
  const t = useTranslations("payoutsPage");
  const tc = useTranslations("common");
  const { kit, credentialId } = useSmartAccountKitContext();
  const dash = useDashboardProfile();
  const canSendPizza = !!dash?.profile?.can_send_pizza;
  const userDisplayName =
    dash?.profile?.username?.trim() ||
    dash?.profile?.email?.split("@")[0] ||
    tc("you");

  const [formKey, setFormKey] = useState(0);
  const [payouts, setPayouts] = useState<RecentSend[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [payoutWalletAddress, setPayoutWalletAddress] = useState<string | null>(null);

  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutModalStatus, setPayoutModalStatus] = useState<"confirm" | "submitting" | "success" | "failed">("confirm");
  const [payoutModalSummary, setPayoutModalSummary] = useState<{
    amount: string;
    destination?: string;
    recipientLabel?: string;
    asset?: string;
  } | null>(null);
  const [payoutModalSuccess, setPayoutModalSuccess] = useState<PayoutModalSuccess | null>(null);
  const [payoutModalError, setPayoutModalError] = useState<string | null>(null);
  const [pendingConfirmBody, setPendingConfirmBody] = useState<StellarPayoutBody | null>(null);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlockSecretKey, setUnlockSecretKey] = useState("");
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [pendingPayoutBody, setPendingPayoutBody] = useState<StellarPayoutBody | null>(null);

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
    asset?: string;
  } | null>(null);

  const [lastSuccess, setLastSuccess] = useState<PayoutSuccess | null>(null);

  function loadPayouts() {
    fetch("/api/payouts")
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((d) => {
        const rows = (d.payouts ?? []) as RecentSend[];
        setPayouts(rows.filter((p) => p.type === "to_stellar" || !!p.stellarTxHash || !!p.stellarAddress).slice(0, 8));
      });
  }

  useEffect(() => {
    fetch("/api/payouts")
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((d) => {
        const rows = (d.payouts ?? []) as RecentSend[];
        setPayouts(rows.filter((p) => p.type === "to_stellar" || !!p.stellarTxHash || !!p.stellarAddress).slice(0, 8));
      })
      .finally(() => setLoadingHistory(false));
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: { org_payout_wallet_public_key?: string | null; org_stellar_disbursement_public_key?: string | null }) => {
        setPayoutWalletAddress(p.org_payout_wallet_public_key ?? p.org_stellar_disbursement_public_key ?? null);
      });
  }, []);

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

  function handleConfirmSend() {
    if (!pendingConfirmBody) return;
    setPayoutModalStatus("submitting");
    const body = pendingConfirmBody;
    setPendingConfirmBody(null);
    submitPayoutBody(body)
      .then(async ({ ok, data: d }) => {
        const data = d as {
          payout?: { amount?: string; stellarTxHash?: string; stellarAddress?: string; recipientLabel?: string };
          error?: string;
          requireUnlock?: boolean;
          requirePayoutPassword?: boolean;
          requirePasskeySign?: boolean;
          payoutId?: string;
          unsignedEnvelopeXdr?: string;
          network?: string;
          amount?: string;
          destination?: string;
          recipientLabel?: string;
        };
        if (isPollarClientTxChallenge(data)) {
          try {
            const result = await executeAndCompletePollarClientPayout(data);
            finishSuccess({
              amount: result.payout.amount ?? body.amount,
              destination: result.payout.stellarAddress ?? body.destination,
              recipientLabel: result.payout.recipientLabel ?? body.recipientLabel,
              stellarTxHash: result.stellarTxHash,
              asset: body.asset ?? "USDC",
            });
          } catch (err) {
            setPayoutModalStatus("failed");
            setPayoutModalError(err instanceof Error ? err.message : t("alertPayoutFailed"));
          }
          return;
        }
        if (data.requirePasskeySign && data.payoutId && data.destination) {
          if (!kit) {
            setPayoutModalStatus("failed");
            setPayoutModalError(t("passkeyKitNotReady"));
            return;
          }
          try {
            const result = await executePasskeySorobanPayout({
              kit,
              credentialId,
              payoutId: String(data.payoutId),
              recipientAddress: String(data.destination),
              amount: String(data.amount ?? body.amount),
              recipientLabel: data.recipientLabel ?? body.recipientLabel,
            });
            finishSuccess({
              amount: result.payout.amount ?? body.amount,
              destination: result.payout.stellarAddress ?? body.destination,
              recipientLabel: result.payout.recipientLabel ?? body.recipientLabel,
              stellarTxHash: result.stellarTxHash,
              asset: body.asset ?? "USDC",
            });
          } catch (err) {
            setPayoutModalStatus("failed");
            setPayoutModalError(err instanceof Error ? err.message : t("alertPayoutFailed"));
          }
          return;
        }
        if (data.requirePayoutPassword && data.unsignedEnvelopeXdr && data.payoutId) {
          setPayoutModalOpen(false);
          setPendingPayoutPasswordData({
            payoutId: String(data.payoutId),
            unsignedEnvelopeXdr: String(data.unsignedEnvelopeXdr),
            network: String(data.network ?? "testnet"),
            amount: String(data.amount ?? body.amount),
            destination: String(data.destination ?? body.destination),
            recipientLabel: data.recipientLabel ?? body.recipientLabel,
            asset: body.asset ?? "USDC",
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
          finishSuccess({
            amount: typeof p.amount === "string" ? p.amount : body.amount,
            destination: p.stellarAddress ?? body.destination,
            recipientLabel: p.recipientLabel ?? body.recipientLabel,
            stellarTxHash: p.stellarTxHash,
            asset: body.asset ?? "USDC",
          });
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

  function finishSuccess(payout: PayoutSuccess) {
    setPayoutModalStatus("success");
    setPayoutModalSuccess(payout);
    setLastSuccess(payout);
    setFormKey((k) => k + 1);
    loadPayouts();
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
      const success: PayoutSuccess = {
        amount: p?.amount ?? data.amount,
        stellarTxHash: p?.stellarTxHash,
        recipientLabel: p?.recipientLabel ?? data.recipientLabel,
        destination: p?.stellarAddress ?? data.destination,
        asset: (data.asset as PayoutSuccess["asset"]) ?? "USDC",
      };
      setPayoutModalStatus("success");
      setPayoutModalSuccess(success);
      setLastSuccess(success);
      setFormKey((k) => k + 1);
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
    const pending = pendingPayoutBody;
    if ((!passphrase && !secretKey) || !pending) return;
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
        return submitPayoutBody(pending);
      })
      .then((result) => {
        if (!result) return;
        setShowUnlockModal(false);
        setUnlockPassphrase("");
        setUnlockSecretKey("");
        setPendingPayoutBody(null);
        if (result.ok) {
          const p = (result.data as { payout?: { amount?: string; stellarTxHash?: string; stellarAddress?: string; recipientLabel?: string } }).payout;
          finishSuccess({
            amount: p?.amount ?? pending.amount,
            destination: p?.stellarAddress ?? pending.destination,
            recipientLabel: p?.recipientLabel ?? pending.recipientLabel,
            stellarTxHash: p?.stellarTxHash,
            asset: pending.asset ?? "USDC",
          });
          setPayoutModalOpen(true);
        } else {
          setPayoutModalOpen(true);
          setPayoutModalStatus("failed");
          setPayoutModalError((result.data?.error as string) ?? t("alertPayoutFailed"));
        }
      })
      .catch(() => alert(t("alertUnlockFailed")))
      .finally(() => setUnlockSubmitting(false));
  }

  return (
    <>
      <div className="mt-6 max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
        <SendUsdcForm
          key={formKey}
          canSendPizza={canSendPizza}
          onSubmitting={(summary, body) => {
            setPayoutModalSummary(summary);
            setPayoutModalSuccess(null);
            setPayoutModalError(null);
            setPendingConfirmBody(body);
            setPayoutModalStatus("confirm");
            setPayoutModalOpen(true);
          }}
          onSent={(payout) => finishSuccess(payout)}
          onFailed={(error) => {
            setPayoutModalStatus("failed");
            setPayoutModalError(error);
            setPayoutModalOpen(true);
          }}
          onRequireUnlock={(body) => {
            setPayoutModalOpen(false);
            setPendingPayoutBody(body);
            setShowUnlockModal(true);
          }}
        />
      </div>

      {lastSuccess && (
        <div
          role="alert"
          className="mt-6 max-w-lg rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start justify-between gap-4"
        >
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">{t("payoutSent")}</p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {t("sentTo", {
                amount: lastSuccess.amount,
                asset: lastSuccess.asset ?? "USDC",
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

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-semibold text-white">{t("historyTitle")}</h2>
        {loadingHistory ? (
          <div className="mt-4 h-24 animate-pulse rounded-lg border border-gray-200 dark:border-gray-700" />
        ) : payouts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("noPayouts")}</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="p-3 text-left font-medium">{t("colDate")}</th>
                  <th className="p-3 text-left font-medium">{t("colAmount")}</th>
                  <th className="p-3 text-left font-medium">{t("colType")}</th>
                  <th className="p-3 text-left font-medium">{t("colExpert")}</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      {p.amount} {p.asset ?? "USDC"}
                    </td>
                    <td className="p-3">
                      {t("payoutType")}
                      {p.recipientLabel ? ` – ${p.recipientLabel}` : ""}
                    </td>
                    <td className="p-3">
                      {p.stellarTxHash ? (
                        <a
                          href={`${STELLAR_EXPERT_BASE}/tx/${p.stellarTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
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
      </section>

      <PayoutStatusModal
        open={payoutModalOpen}
        onClose={() => {
          setPayoutModalOpen(false);
          setPayoutModalSummary(null);
          setPayoutModalSuccess(null);
          setPayoutModalError(null);
          setPendingConfirmBody(null);
        }}
        status={payoutModalStatus}
        userName={userDisplayName}
        payoutSummary={payoutModalSummary ?? undefined}
        successData={payoutModalSuccess}
        errorMessage={payoutModalError}
        onConfirm={payoutModalStatus === "confirm" ? handleConfirmSend : undefined}
      />

      {showPayoutPasswordModal && pendingPayoutPasswordData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payout-password-title">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
            <h2 id="payout-password-title" className="text-lg font-semibold">{t("payoutPasswordTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("payoutPasswordApprove", {
                amount: pendingPayoutPasswordData.amount,
                asset: pendingPayoutPasswordData.asset ?? "USDC",
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
                <label htmlFor="send-payout-password" className="block text-sm font-medium">{t("payoutPasswordLabel")}</label>
                <input
                  id="send-payout-password"
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("unlockBody")}</p>
            {payoutWalletAddress && (
              <p className="mt-2 break-all text-xs font-mono text-gray-600 dark:text-gray-300">{t("payoutWalletLabel")} {payoutWalletAddress}</p>
            )}
            <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="send-unlock-passphrase" className="block text-sm font-medium">{t("passphraseLabel")}</label>
                <input
                  id="send-unlock-passphrase"
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
                <label htmlFor="send-unlock-secret" className="block text-sm font-medium">{t("walletSecretLabel")}</label>
                <input
                  id="send-unlock-secret"
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
    </>
  );
}
