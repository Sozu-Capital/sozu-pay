"use client";

import { useEffect, useState } from "react";

export type DashboardProfileSummary = {
  email?: string;
  username?: string | null;
  org_name?: string | null;
};

export function useDashboardProfile() {
  const [profile, setProfile] = useState<DashboardProfileSummary | null>(null);

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setProfile({
            email: data.email,
            username: data.username ?? null,
            org_name: data.org_name ?? null,
          });
        }
      })
      .catch(() => setProfile(null));
  }, []);

  return profile;
}
