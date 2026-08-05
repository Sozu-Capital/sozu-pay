"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { TransactionRow } from "@/lib/stellar/transactions";

export type DashboardProfile = {
  email?: string | null;
  username?: string | null;
  org_name?: string | null;
  org_soroban_contract_id?: string | null;
  org_treasury_contract_id?: string | null;
  needsPayoutWalletSetup?: boolean;
  needsSmartWalletSetup?: boolean;
  needsOrgCreation?: boolean;
  needsOrganization?: boolean;
  admin_level?: string | null;
  can_manage_disbursements?: boolean;
  member_smart_account_id?: string | null;
  smart_wallet_ready?: boolean;
  org_id?: string | null;
  org_type?: "store" | "ngo" | null;
  is_pollar_user?: boolean;
  is_treasury_owner?: boolean;
};

export type DashboardBalanceData = {
  usdc: string;
  available: string;
  inVault: string;
  fiatAmount: string;
  fiatCurrency: string;
  localFiatAmount: string;
  localFiatCurrency: string;
  rateSource: string;
  /** SDP distribution G wallet — batch payout pool */
  distributionUsdc?: string;
  sdpDistributionConfigured?: boolean;
};

export type DashboardStats = {
  balanceUsd: string;
  transactionCount: number;
  apyPercent: number;
  creditAvailableUsd: string;
  currency: string;
};

const DashboardProfileContext = createContext<{
  profile: DashboardProfile | null;
  balance: DashboardBalanceData | null;
  stats: DashboardStats | null;
  transactions: TransactionRow[];
  loading: boolean;
  refetch: () => void;
} | null>(null);

export function useDashboardProfile() {
  return useContext(DashboardProfileContext);
}

type BootstrapData = {
  profile: DashboardProfile;
  balance: DashboardBalanceData;
  stats: DashboardStats;
  transactions: TransactionRow[];
};

export function DashboardProfileProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: BootstrapData | null;
}) {
  const [profile, setProfile] = useState<DashboardProfile | null>(initialData?.profile ?? null);
  const [balance, setBalance] = useState<DashboardBalanceData | null>(initialData?.balance ?? null);
  const [stats, setStats] = useState<DashboardStats | null>(initialData?.stats ?? null);
  const [transactions, setTransactions] = useState<TransactionRow[]>(initialData?.transactions ?? []);
  // If the layout already prefetched data, start in non-loading state.
  const [loading, setLoading] = useState(!initialData);

  const fetchBootstrap = useCallback(() => {
    setLoading(true);
    // Cache-bust so external deposits/disbursements show without a hard reload.
    const url = `/api/dashboard/bootstrap?ts=${Date.now()}`;
    fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          setProfile(null);
          if (typeof window !== "undefined") window.location.href = "/";
          return;
        }
        return r.ok ? r.json() : null;
      })
      .then((data: { profile: DashboardProfile; balance: DashboardBalanceData; stats: DashboardStats; transactions: TransactionRow[] } | null | void) => {
        if (!data) return;
        setProfile(data.profile ?? null);
        setBalance(data.balance ?? null);
        setStats(data.stats ?? null);
        setTransactions(data.transactions ?? []);
      })
      .catch(() => {
        // Keep existing profile on transient network errors during polling.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Poll so balances update after external deposits (e.g. Stellar Expert shows it but UI won't refresh).
  useEffect(() => {
    const intervalMs = 10_000;
    if (typeof window === "undefined") return;

    let timer: number | null = null;
    const shouldPoll = () => {
      // If no org treasury is configured yet, no need to poll.
      if (!profile?.org_treasury_contract_id && !profile?.org_soroban_contract_id) return false;
      if (document.visibilityState !== "visible") return false;
      return true;
    };

    const tick = () => {
      if (!shouldPoll()) return;
      fetchBootstrap();
    };

    if (shouldPoll()) {
      timer = window.setInterval(tick, intervalMs);
    }
    const onVis = () => {
      if (shouldPoll()) {
        fetchBootstrap();
        if (timer == null) timer = window.setInterval(tick, intervalMs);
      } else if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer != null) window.clearInterval(timer);
    };
  }, [fetchBootstrap, profile?.org_treasury_contract_id, profile?.org_soroban_contract_id]);

  return (
    <DashboardProfileContext.Provider
      value={{ profile, balance, stats, transactions, loading, refetch: fetchBootstrap }}
    >
      {children}
    </DashboardProfileContext.Provider>
  );
}
