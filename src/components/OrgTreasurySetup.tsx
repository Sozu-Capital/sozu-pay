"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";

type TreasuryStatus = {
  org: {
    classic_public_key: string | null;
    soroban_contract_id: string | null;
    treasury_contract_id: string | null;
  };
  member_smart_account: { contract_id: string } | null;
  org_treasury_smart_account: { contract_id: string } | null;
  migration: {
    hasClassicWallet: boolean;
    hasDisbursementContract: boolean;
    hasTreasurySmartAccount: boolean;
    readyForPasskeyPayouts: boolean;
  };
  next_steps: string[];
};

function b64url(u8: Uint8Array): string {
  const bin = String.fromCharCode(...u8);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function OrgTreasurySetup({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const t = useTranslations("profilePage");
  const { ready, kit, createWallet } = useSmartAccountKitContext();
  const [status, setStatus] = useState<TreasuryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [contractIdInput, setContractIdInput] = useState("");
  const [migrateAmount, setMigrateAmount] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/profile/org/treasury", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStatus(d as TreasuryStatus);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  if (!isSuperAdmin) return null;
  if (loading && !status) {
    return <p className="mt-4 text-sm text-gray-500">{t("treasuryLoading")}</p>;
  }
  if (!status) return null;

  const storeOrgTreasury = async () => {
    if (!kit) return;
    setBusy("org_treasury");
    setErr(null);
    setMsg(null);
    try {
      const res = await createWallet("SozuPay Org Treasury", "treasury");
      const all = await kit.credentials.getAll();
      const match = all.find((c) => c.credentialId === res.credentialId);
      if (!match) throw new Error(t("treasuryPasskeyFailed"));
      const registerRes = await fetch("/api/smart-accounts/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "org_treasury",
          contractId: res.contractId,
          credentialId: res.credentialId,
          publicKey65b: b64url(match.publicKey),
          label: "Org treasury passkey",
        }),
      });
      const data = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) throw new Error(data.error ?? t("treasuryRegisterFailed"));
      setMsg(t("treasuryOrgSaReady"));
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("treasuryRegisterFailed"));
    } finally {
      setBusy(null);
    }
  };

  const bootstrap = async () => {
    setBusy("bootstrap");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/org/treasury/bootstrap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: contractIdInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("treasuryBootstrapFailed"));
      setMsg(t("treasuryBootstrapOk"));
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("treasuryBootstrapFailed"));
    } finally {
      setBusy(null);
    }
  };

  const migrate = async () => {
    setBusy("migrate");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/org/treasury/migrate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: migrateAmount.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("treasuryMigrateFailed"));
      setMsg(t("treasuryMigrateOk", { hash: data.txHash ?? "" }));
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("treasuryMigrateFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <h2 className="text-lg font-semibold">{t("treasuryTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("treasuryBody")}</p>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-500">{t("treasuryClassic")}</dt>
          <dd className="font-mono break-all">{status.org.classic_public_key ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-500">{t("treasuryMemberSa")}</dt>
          <dd className="font-mono break-all">
            {status.member_smart_account?.contract_id ?? (
              <Link href="/onboarding/setup-smart-wallet" className="text-blue-600 hover:underline">
                {t("treasurySetupMember")}
              </Link>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-500">{t("treasuryDisbContract")}</dt>
          <dd className="font-mono break-all">{status.org.soroban_contract_id ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-500">{t("treasuryOrgSa")}</dt>
          <dd className="font-mono break-all">{status.org.treasury_contract_id ?? "—"}</dd>
        </div>
      </dl>

      {!status.org_treasury_smart_account && (
        <button
          type="button"
          disabled={!ready || busy !== null}
          onClick={() => void storeOrgTreasury()}
          className="mt-4 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "org_treasury" ? t("treasuryWorking") : t("treasuryCreateOrgSa")}
        </button>
      )}

      {!status.migration.hasDisbursementContract && status.member_smart_account && (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t("treasuryContractIdLabel")}
          </label>
          <input
            value={contractIdInput}
            onChange={(e) => setContractIdInput(e.target.value)}
            placeholder="C..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            disabled={!contractIdInput.trim().startsWith("C") || busy !== null}
            onClick={() => void bootstrap()}
            className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "bootstrap" ? t("treasuryWorking") : t("treasuryBootstrap")}
          </button>
        </div>
      )}

      {status.migration.hasDisbursementContract && status.migration.hasClassicWallet && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("treasuryMigrateAmount")}
            </label>
            <input
              type="text"
              value={migrateAmount}
              onChange={(e) => setMigrateAmount(e.target.value)}
              className="w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void migrate()}
            className="rounded-md bg-green-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "migrate" ? t("treasuryWorking") : t("treasuryMigrate")}
          </button>
        </div>
      )}

      {status.migration.readyForPasskeyPayouts && (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">{t("treasuryReady")}</p>
      )}

      {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </section>
  );
}
