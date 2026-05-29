"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SmartAccountKit, ConnectWalletResult, CreateWalletResult } from "smart-account-kit";
import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client";

type SmartAccountContextValue = {
  ready: boolean;
  kit: SmartAccountKit | null;
  connected: boolean;
  contractId: string | null;
  credentialId: string | null;
  error: string | null;
  connect: (opts?: { prompt?: boolean; fresh?: boolean }) => Promise<{
    contractId: string | null;
    credentialId: string | null;
  }>;
  createWallet: (userLabel: string, userName: string) => Promise<CreateWalletResult>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<SmartAccountContextValue | null>(null);

export function SmartAccountKitProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [kit, setKit] = useState<SmartAccountKit | null>(null);
  const [connected, setConnected] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { kit } = await getSmartAccountKit();
        if (cancelled) return;
        setKit(kit);
        const res = (await kit.connectWallet()) as ConnectWalletResult | null;
        if (res?.contractId) {
          setConnected(true);
          setContractId(res.contractId);
          setCredentialId(res.credentialId ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Smart account init failed");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (opts?: { prompt?: boolean; fresh?: boolean }) => {
    if (!kit) throw new Error("Smart account kit not ready");
    setError(null);
    const res = (await kit.connectWallet(opts)) as ConnectWalletResult | null;
    if (res?.contractId) {
      setConnected(true);
      setContractId(res.contractId);
      setCredentialId(res.credentialId ?? null);
      return { contractId: res.contractId, credentialId: res.credentialId ?? null };
    }
    setConnected(false);
    setContractId(null);
    setCredentialId(null);
    return { contractId: null, credentialId: null };
  }, [kit]);

  const createWallet = useCallback(async (userLabel: string, userName: string) => {
    if (!kit) throw new Error("Smart account kit not ready");
    setError(null);
    const res = await kit.createWallet(userLabel, userName, { autoSubmit: true });
    setConnected(true);
    setContractId(res.contractId);
    setCredentialId(res.credentialId ?? null);
    return res;
  }, [kit]);

  const disconnect = useCallback(async () => {
    if (!kit) return;
    await kit.disconnect();
    setConnected(false);
    setContractId(null);
    setCredentialId(null);
  }, [kit]);

  const value = useMemo<SmartAccountContextValue>(() => ({
    ready,
    kit,
    connected,
    contractId,
    credentialId,
    error,
    connect,
    createWallet,
    disconnect,
  }), [ready, kit, connected, contractId, credentialId, error, connect, createWallet, disconnect]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartAccountKitContext(): SmartAccountContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSmartAccountKitContext must be used within SmartAccountKitProvider");
  return v;
}

