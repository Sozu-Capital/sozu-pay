"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Transaction, Keypair } from "@stellar/stellar-sdk";

type Profile = {
  stellar_public_key: string | null;
  email?: string;
};

export function SdpRegisterFlow() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [secretInput, setSecretInput] = useState("");
  const [sep10Busy, setSep10Busy] = useState(false);
  const [sep10Error, setSep10Error] = useState<string | null>(null);
  const [sep10Done, setSep10Done] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [pollTx, setPollTx] = useState<unknown[] | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    setLoadingProfile(true);
    fetch("/api/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setProfile(null);
          return;
        }
        setProfile({
          stellar_public_key: data.stellar_public_key ?? null,
          email: data.email,
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const runSep10 = async () => {
    setSep10Error(null);
    const secret = secretInput.trim();
    if (!secret || !secret.startsWith("S")) {
      setSep10Error("Enter your Stellar secret key (starts with S) for the account registered in Profile.");
      return;
    }

    setSep10Busy(true);
    try {
      const chRes = await fetch("/api/sdp/sep10/challenge", {
        credentials: "include",
      });
      const chData = await chRes.json().catch(() => ({}));
      if (!chRes.ok) {
        throw new Error(chData.error ?? "Challenge failed");
      }

      const tx = new Transaction(
        chData.transaction_xdr as string,
        chData.network_passphrase as string
      );
      const kp = Keypair.fromSecret(secret);
      tx.sign(kp);
      const signedXdr = tx.toEnvelope().toXDR("base64");

      const tokRes = await fetch("/api/sdp/sep10/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_xdr: signedXdr,
          network_passphrase: chData.network_passphrase,
          server_account_id: chData.server_account_id,
          web_auth_domain: chData.web_auth_domain,
          home_domains: chData.home_domains,
        }),
      });
      const tokData = await tokRes.json().catch(() => ({}));
      if (!tokRes.ok) {
        throw new Error(tokData.error ?? "Token exchange failed");
      }
      setSep10Done(true);
      setSecretInput("");
    } catch (e) {
      setSep10Error(e instanceof Error ? e.message : "SEP-10 failed");
    } finally {
      setSep10Busy(false);
    }
  };

  const openDeposit = async () => {
    setDepositError(null);
    setDepositBusy(true);
    try {
      const res = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Deposit start failed");
      }
      const url = data.url as string;
      if (typeof url === "string" && url.startsWith("http")) {
        window.location.assign(url);
      } else {
        throw new Error("No interactive URL returned");
      }
    } catch (e) {
      setDepositError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setDepositBusy(false);
    }
  };

  const pollTransactions = async () => {
    setPollError(null);
    try {
      const res = await fetch("/api/sdp/sep24/transactions", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Poll failed");
      }
      setPollTx(data.transactions ?? []);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Poll failed");
    }
  };

  if (loadingProfile) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (!profile?.stellar_public_key) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="text-xl font-semibold">Disbursement registration</h1>
        <p className="text-sm text-gray-300">
          Add a Stellar wallet to your account first, then return to this page.
        </p>
        <Link
          href="/dashboard/profile"
          className="inline-block rounded-md bg-white text-gray-900 py-2 px-4 text-sm font-medium"
        >
          Open Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Receive your payment</h1>
        <p className="text-sm text-gray-400 mt-1">
          Account <span className="text-gray-200 font-mono text-xs break-all">{profile.stellar_public_key}</span>
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Complete Stellar authentication, then open the disbursement site to verify your details. Your secret key is
          only used in this browser to sign the SEP-10 challenge and is not sent to our servers.
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">1. Sign in with Stellar (SEP-10)</h2>
        {!sep10Done ? (
          <>
            <input
              type="password"
              autoComplete="off"
              placeholder="Stellar secret key (S…)"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              disabled={sep10Busy}
              onClick={() => void runSep10()}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium"
            >
              {sep10Busy ? "Signing…" : "Sign challenge"}
            </button>
            {sep10Error && <p className="text-sm text-red-400">{sep10Error}</p>}
          </>
        ) : (
          <p className="text-sm text-emerald-400">Authenticated with disbursement platform.</p>
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">2. USDC trustline (if required)</h2>
        <p className="text-xs text-gray-400">
          If the payment is USDC, ensure a trustline exists from Profile → trustline, or Horizon will reject the credit.
        </p>
        <Link
          href="/dashboard/profile"
          className="text-sm text-blue-400 hover:underline"
        >
          Check trustline in Profile
        </Link>
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">3. Open registration (SEP-24)</h2>
        <p className="text-xs text-gray-400">
          You will complete phone or ID verification on the disbursement site. Do not share codes with anyone.
        </p>
        <button
          type="button"
          disabled={!sep10Done || depositBusy}
          onClick={() => void openDeposit()}
          className="rounded-md bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 px-4 py-2 text-sm font-medium"
        >
          {depositBusy ? "Opening…" : "Continue to verification"}
        </button>
        {depositError && <p className="text-sm text-red-400">{depositError}</p>}
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">4. Transaction status</h2>
        <button
          type="button"
          disabled={!sep10Done}
          onClick={() => void pollTransactions()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          Refresh status
        </button>
        {pollError && <p className="text-sm text-red-400">{pollError}</p>}
        {pollTx && (
          <pre className="text-xs text-gray-400 overflow-auto max-h-48 p-2 bg-black/50 rounded">
            {JSON.stringify(pollTx, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
