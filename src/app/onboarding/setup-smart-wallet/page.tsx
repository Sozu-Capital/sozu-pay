"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";

function b64url(u8: Uint8Array): string {
  const bin = String.fromCharCode(...u8);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function SetupSmartWalletPage() {
  const router = useRouter();
  const { ready, kit, connected, contractId, credentialId, error, createWallet, connect } =
    useSmartAccountKitContext();

  const [profileEmail, setProfileEmail] = useState<string>("user");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.email === "string" && d.email) setProfileEmail(d.email);
      })
      .catch(() => {});
  }, []);

  const canProceed = ready && !!kit;

  const storeToServer = async (label: string) => {
    if (!kit || !contractId || !credentialId) throw new Error("Not connected");
    const all = await kit.credentials.getAll();
    const match = all.find((c) => c.credentialId === credentialId);
    if (!match) throw new Error("Credential not found in local storage");
    const publicKey65b = b64url(match.publicKey);

    const res = await fetch("/api/smart-accounts/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "member",
        contractId,
        credentialId,
        publicKey65b,
        label,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to save wallet");
  };

  const handleCreate = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await createWallet("SozuPay", profileEmail);
      await storeToServer("Primary passkey");
      router.replace("/dashboard");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectExisting = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await connect({ prompt: true });
      await storeToServer("Passkey");
      router.replace("/dashboard");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-950 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-lg font-semibold">Set up your smart wallet</h1>
        <p className="mt-2 text-sm text-gray-300">
          Create (or connect) a passkey-based smart account. No secret keys are stored on our servers.
        </p>

        {!canProceed && <p className="mt-4 text-sm text-gray-400">Loading…</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={!canProceed || saving}
            onClick={() => void handleCreate()}
            className="rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium disabled:opacity-50"
          >
            Create smart wallet (passkey)
          </button>
          <button
            type="button"
            disabled={!canProceed || saving}
            onClick={() => void handleConnectExisting()}
            className="rounded-md border border-white/20 bg-white/5 py-2.5 px-4 font-medium disabled:opacity-50"
          >
            Connect existing passkey
          </button>
          {connected && contractId && (
            <p className="text-xs text-gray-400 break-all">
              Connected contract: <span className="font-mono">{contractId}</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

