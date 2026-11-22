"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HomePollarAuth } from "@/components/HomePollarAuth";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import {
  getPollarBrowserClient,
  isPollarFakeAuth,
  waitForPollarClientReady,
} from "@/lib/pollar/browser-client";
import { sendUsdcViaPollarClient } from "@/lib/pollar/client-usdc-send";
import {
  classifyDeviceKeys,
  pollarErrorMessage,
  turnkeyMatchBlockedReason,
  type DeviceKeyMatch,
} from "@/lib/pollar/device-keys";
import { dumpPollarIndexedDb, type PollarIndexedDbDump } from "@/lib/pollar/indexed-db-keys";
import {
  pollarRecoveryApi,
  snapshotPollarCosign,
  type PollarCosignSnapshot,
} from "@/lib/pollar/recovery-client";

type HorizonBalances = {
  usdc: string;
  xlm: string;
  signers: string[];
};

function KeyList({ keys, empty }: { keys: string[]; empty: string }) {
  if (!keys.length) return <p className="text-sm text-white/60">{empty}</p>;
  return (
    <ul className="space-y-1">
      {keys.map((key) => (
        <li key={key} className="break-all font-mono text-xs text-white/90">
          {key}
        </li>
      ))}
    </ul>
  );
}

export function PollarDeviceKeysPage() {
  const t = useTranslations("deviceKeysPage");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [idb, setIdb] = useState<PollarIndexedDbDump | null>(null);
  const [cosign, setCosign] = useState<PollarCosignSnapshot | null>(null);
  const [match, setMatch] = useState<DeviceKeyMatch | null>(null);
  const [horizon, setHorizon] = useState<HorizonBalances | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const fake = isPollarFakeAuth();

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const dump = await dumpPollarIndexedDb();
      setIdb(dump);
      if (fake) {
        setCosign(null);
        setMatch(null);
        setHorizon(null);
        return;
      }
      const client = getPollarBrowserClient();
      if (!client) {
        setCosign(null);
        setMatch(null);
        setHorizon(null);
        return;
      }
      const snapshot = await snapshotPollarCosign(client);
      setCosign(snapshot);
      const blocked = turnkeyMatchBlockedReason({
        authStep: snapshot.authStep,
        authVerified: snapshot.authVerified,
        devicesError: snapshot.devicesError,
      });
      setMatch(
        blocked
          ? null
          : classifyDeviceKeys({
              localPublicKeys: [
                ...dump.publicKeys,
                ...(snapshot.localPublicKeyHex ? [snapshot.localPublicKeyHex] : []),
              ],
              enrolledPublicKeys: snapshot.enrolledPublicKeys,
            }),
      );
      const address = snapshot.walletAddress;
      if (address?.startsWith("G")) {
        try {
          const res = await fetch(`https://horizon.stellar.org/accounts/${address}`);
          if (res.ok) {
            const account = (await res.json()) as {
              balances?: Array<{
                asset_type?: string;
                asset_code?: string;
                balance?: string;
              }>;
              signers?: Array<{ key?: string }>;
            };
            const usdc = account.balances?.find(
              (row) => row.asset_code === "USDC" && row.asset_type !== "native",
            );
            const xlm = account.balances?.find((row) => row.asset_type === "native");
            setHorizon({
              usdc: usdc?.balance ?? "0",
              xlm: xlm?.balance ?? "0",
              signers: (account.signers ?? [])
                .map((signer) => signer.key)
                .filter((key): key is string => typeof key === "string"),
            });
            if (usdc?.balance) {
              setAmount((current) => current || usdc.balance!.replace(/0+$/, "").replace(/\.$/, "") || usdc.balance!);
            }
          } else {
            setHorizon(null);
          }
        } catch {
          setHorizon(null);
        }
      } else {
        setHorizon(null);
      }
    } catch (err) {
      setError(pollarErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [fake]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(label);
      await refresh();
    } catch (err) {
      setError(pollarErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function withRecovery<T>(fn: (api: ReturnType<typeof pollarRecoveryApi>) => Promise<T>) {
    const client = getPollarBrowserClient();
    if (!client) throw new Error(t("pollarMissing"));
    await waitForPollarClientReady(client);
    const api = pollarRecoveryApi(client);
    return fn(api);
  }

  const blocked =
    fake
      ? null
      : !cosign
        ? "pollar_login_required"
        : turnkeyMatchBlockedReason({
            authStep: cosign.authStep,
            authVerified: cosign.authVerified,
            devicesError: cosign.devicesError,
          });
  const enrolled = !blocked && match?.thisDeviceEnrolled === true;
  const wallet = cosign?.walletAddress ?? null;
  const idbRecordCount =
    idb?.databases.reduce(
      (sum, db) => sum + db.stores.reduce((inner, store) => inner + store.recordCount, 0),
      0,
    ) ?? 0;

  return (
    <DarkGradientBg>
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10 text-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">{t("kicker")}</p>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-sm text-white/70">{t("intro")}</p>
        </div>

        {fake ? <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">{t("fakeAuth")}</p> : null}
        {error ? <p className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm">{error}</p> : null}
        {notice ? <p className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm">{notice}</p> : null}

        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
          <h2 className="text-sm font-semibold">{t("browserTitle")}</h2>
          <p className="text-xs text-white/60">{t("originLabel")}: {idb?.origin ?? "—"}</p>
          <p className="text-xs text-white/60">
            {t("dbLabel")}:{" "}
            {idb?.databases
              .map((db) => {
                const stores = db.stores
                  .map((store) => `${store.name} (${store.recordCount})`)
                  .join(", ");
                return `${db.name} v${db.version ?? "?"}${stores ? ` · ${stores}` : ""}`;
              })
              .join("; ") || t("noDb")}
          </p>
          {cosign?.localPublicKeyHex ? (
            <p className="break-all font-mono text-xs text-white/90">
              {t("thisDevice")}: {cosign.localPublicKeyHex}
            </p>
          ) : null}
          {cosign?.localKeyError ? <p className="text-xs text-amber-200">{cosign.localKeyError}</p> : null}
          <KeyList
            keys={idb?.publicKeys ?? []}
            empty={idbRecordCount > 0 ? t("noHexKeys") : t("noLocalKeys")}
          />
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("walletTitle")}</h2>
          {busy ? <p className="text-sm text-white/60">{t("loading")}</p> : null}
          {blocked === "pollar_login_required" ? (
            <>
              <p className="text-sm text-amber-100">{t("needsLoginBody")}</p>
              <HomePollarAuth returnTo="/device-keys" ignoreExistingSession />
            </>
          ) : (
            <p className="break-all font-mono text-xs">{wallet ?? t("noWallet")}</p>
          )}
          {cosign?.provisioning ? (
            <p className="text-xs text-white/60">{t("provisioning")}: {cosign.provisioning}</p>
          ) : null}
          {horizon ? (
            <p className="text-sm text-white/80">
              {horizon.usdc} USDC · {horizon.xlm} XLM
            </p>
          ) : null}
          {horizon?.signers.length ? (
            <p className="break-all font-mono text-[11px] text-white/50">
              {t("signers")}: {horizon.signers.join(" ")}
            </p>
          ) : null}
          {cosign?.recoveryError ? <p className="text-xs text-amber-200">{cosign.recoveryError}</p> : null}
          {cosign?.devicesError ? <p className="text-xs text-amber-200">{cosign.devicesError}</p> : null}
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("matchTitle")}</h2>
          <p className="text-sm text-white/80">
            {blocked === "pollar_login_required"
              ? t("matchNeedsLogin")
              : blocked === "turnkey_unreachable"
                ? t("matchUnreachable")
                : enrolled
                  ? t("matchYes")
                  : t("matchNo")}
          </p>
          {blocked ? null : (
            <>
              <div>
                <p className="text-xs uppercase text-white/50">{t("enrolledHere")}</p>
                <KeyList keys={match?.enrolledLocalKeys ?? []} empty={t("none")} />
              </div>
              <div>
                <p className="text-xs uppercase text-white/50">{t("localNotEnrolled")}</p>
                <KeyList keys={match?.unenrolledLocalKeys ?? []} empty={t("none")} />
              </div>
              <div>
                <p className="text-xs uppercase text-white/50">{t("enrolledElsewhere")}</p>
                <KeyList keys={match?.enrolledOnlyKeys ?? []} empty={t("none")} />
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("recoveryTitle")}</h2>
          <p className="text-sm text-white/70">{t("recoveryBody")}</p>
          {cosign?.recovery ? (
            <p className="text-xs text-white/60">
              {t("recoveryState", {
                required: String(cosign.recovery.required),
                configured: String(cosign.recovery.configured),
                passkeys: String(cosign.recovery.passkeyCount),
                email: cosign.recovery.email?.address
                  ? `${cosign.recovery.email.address}${cosign.recovery.email.verified ? "" : " *"}`
                  : t("none"),
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy || fake || Boolean(blocked)}
              onClick={() =>
                void runAction(t("addedPasskey"), () =>
                  withRecovery(async (api) => {
                    await api.addPasskey({ name: "SozuPay" });
                  }),
                )
              }
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {t("addPasskey")}
            </button>
            <button
              type="button"
              disabled={actionBusy || fake || Boolean(blocked)}
              onClick={() =>
                void runAction(t("recoveredPasskey"), () =>
                  withRecovery(async (api) => {
                    await api.recoverWithPasskey();
                  }),
                )
              }
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {t("recoverPasskey")}
            </button>
            <button
              type="button"
              disabled={actionBusy || fake || Boolean(blocked)}
              onClick={() =>
                void runAction(t("askedEnrollment"), () =>
                  withRecovery(async (api) => {
                    await api.requestDeviceEnrollment("SozuPay browser");
                  }),
                )
              }
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {t("requestEnrollment")}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={actionBusy || fake || Boolean(blocked) || !email.includes("@")}
              onClick={() =>
                void runAction(t("emailSent"), () =>
                  withRecovery(async (api) => {
                    if (enrolled) await api.startEmail(email.trim());
                    else await api.startEmailRecovery();
                  }),
                )
              }
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {enrolled ? t("confirmEmail") : t("startEmailRecovery")}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={actionBusy || fake || Boolean(blocked) || !code.trim()}
              onClick={() =>
                void runAction(t("codeAccepted"), () =>
                  withRecovery(async (api) => {
                    if (enrolled) await api.confirmEmail(code.trim());
                    else await api.recoverWithEmailCode(code.trim());
                  }),
                )
              }
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {t("submitCode")}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("sendTitle")}</h2>
          <p className="text-sm text-white/70">{enrolled ? t("sendReady") : t("sendLocked")}</p>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t("destinationPlaceholder")}
            className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("amountPlaceholder")}
            className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={actionBusy || fake || !enrolled || !wallet || !destination.startsWith("G") || !amount}
            onClick={() =>
              void runAction(t("sent"), async () => {
                if (!wallet) throw new Error(t("noWallet"));
                const result = await sendUsdcViaPollarClient({
                  destination: destination.trim(),
                  amount: amount.trim(),
                  fromAddress: wallet,
                });
                setTxHash(result.stellarTxHash);
              })
            }
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {t("sendUsdc")}
          </button>
          {txHash ? (
            <p className="break-all font-mono text-xs text-emerald-200">{txHash}</p>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-white/80 underline"
          >
            {t("refresh")}
          </button>
          {blocked === "pollar_login_required" ? null : (
            <Link href="/?fresh=1&returnTo=/device-keys" className="text-white/80 underline">
              {t("googleLogin")}
            </Link>
          )}
          <Link href="/dashboard" className="text-white/80 underline">
            {t("dashboard")}
          </Link>
        </div>
      </main>
    </DarkGradientBg>
  );
}
