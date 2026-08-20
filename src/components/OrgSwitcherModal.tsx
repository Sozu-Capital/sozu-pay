"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { orgSwitcherInitials } from "@/lib/org/org-switcher";

type Org = { id: string; name: string };

type OrgSwitcherModalProps = {
  open: boolean;
  onClose: () => void;
  activeOrgId: string | null;
  accountLabel: string;
};

export function OrgSwitcherModal({
  open,
  onClose,
  activeOrgId,
  accountLabel,
}: OrgSwitcherModalProps) {
  const t = useTranslations("dashboardLayout");
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/organizations", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("switcherFailed"));
        setOrgs([]);
        return;
      }
      setOrgs(Array.isArray(data.organizations) ? data.organizations : []);
    } catch {
      setError(t("switcherFailed"));
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    void loadOrgs();
  }, [open, loadOrgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function handleSelect(orgId: string) {
    if (orgId === activeOrgId) {
      onClose();
      return;
    }
    setError("");
    setSelectingId(orgId);
    try {
      const res = await fetch("/api/auth/set-org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("switcherSwitchFailed"));
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError(t("switcherSwitchFailed"));
    } finally {
      setSelectingId(null);
    }
  }

  function handleCreate() {
    onClose();
    router.push("/onboarding/create-organization");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-switcher-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label={t("closeMenu")}
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-sm max-h-[min(90vh,32rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="org-switcher-title" className="text-base font-semibold text-white">
            {t("switcherTitle")}
          </h2>
          {accountLabel ? (
            <p className="mt-1 truncate text-xs text-gray-400">{t("switcherSignedInAs", { account: accountLabel })}</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">{t("switcherLoading")}</p>
          ) : null}
          {error ? (
            <p className="px-3 py-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {!loading ? (
            <ul className="space-y-0.5">
              {orgs.map((org) => {
                const current = org.id === activeOrgId;
                return (
                  <li key={org.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(org.id)}
                      disabled={!!selectingId}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                        current ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                        {orgSwitcherInitials(org.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{org.name}</span>
                        {current ? (
                          <span className="block text-xs text-gray-400">{t("switcherCurrent")}</span>
                        ) : selectingId === org.id ? (
                          <span className="block text-xs text-gray-400">{t("switcherOpening")}</span>
                        ) : null}
                      </span>
                      {current ? (
                        <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42L8.75 11.84l6.54-6.54a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:opacity-90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("switcherCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}
