"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type DashboardProfile = {
  needsPayoutWalletSetup?: boolean;
  needsSmartWalletSetup?: boolean;
  needsOrgCreation?: boolean;
  needsOrganization?: boolean;
  admin_level?: string | null;
  org_id?: string | null;
  org_type?: "store" | "ngo" | null;
};

const DashboardProfileContext = createContext<{
  profile: DashboardProfile | null;
  loading: boolean;
  refetch: () => void;
} | null>(null);

export function useDashboardProfile() {
  const ctx = useContext(DashboardProfileContext);
  return ctx;
}

export function DashboardProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(() => {
    setLoading(true);
    fetch("/api/profile", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          setProfile(null);
          if (typeof window !== "undefined") window.location.href = "/login";
          return;
        }
        return r.ok ? r.json() : {};
      })
      .then((p: DashboardProfile | void) => {
        if (p && typeof p === "object") setProfile(p);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <DashboardProfileContext.Provider
      value={{ profile, loading, refetch: fetchProfile }}
    >
      {children}
    </DashboardProfileContext.Provider>
  );
}
