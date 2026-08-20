"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { DashboardNav } from "@/components/DashboardNav";
import { OrgSwitcherModal } from "@/components/OrgSwitcherModal";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { resolveAccountDisplayName } from "@/lib/display-name";
import { useTranslations } from "next-intl";

function DashboardBrandHeader({
  className = "",
  switcherOpen,
  onOpenSwitcher,
}: {
  className?: string;
  switcherOpen: boolean;
  onOpenSwitcher: () => void;
}) {
  const { profile, loading } = useDashboardProfile() ?? { profile: null, loading: true };
  const t = useTranslations("dashboardLayout");

  const orgLabel = profile?.org_name?.trim() || (loading ? "…" : t("noOrganization"));
  const accountLabel = loading
    ? "…"
    : resolveAccountDisplayName(profile?.email, t("accountFallback"), profile?.username);

  return (
    <button
      type="button"
      onClick={onOpenSwitcher}
      aria-haspopup="dialog"
      aria-expanded={switcherOpen}
      aria-label={t("switchOrganization")}
      className={`flex min-w-0 w-full items-center gap-2.5 rounded-lg px-1 py-1 -mx-1 text-left hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${className}`}
    >
      <Image
        src="/sozucapital_logo.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
        priority
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white leading-tight">{orgLabel}</p>
        {accountLabel ? (
          <p className="truncate text-xs text-gray-400 leading-tight">{accountLabel}</p>
        ) : null}
      </div>
      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("dashboardLayout");
  const { profile, loading } = useDashboardProfile() ?? { profile: null, loading: true };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openSwitcher = useCallback(() => {
    setMobileOpen(false);
    setSwitcherOpen(true);
  }, []);
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);

  const accountLabel = loading
    ? ""
    : resolveAccountDisplayName(profile?.email, t("accountFallback"), profile?.username);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="dark flex min-h-screen flex-col text-white md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-white/10 md:bg-black/40 md:backdrop-blur-sm md:p-4 md:min-h-0 shrink-0"
        aria-label={t("navAria")}
      >
        <DashboardBrandHeader className="mb-6" switcherOpen={switcherOpen} onOpenSwitcher={openSwitcher} />
        <DashboardNav onNavigate={closeMobile} />
      </aside>

      {/* Mobile: minimal header (no heavy navbar) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-black/20 backdrop-blur-md px-3 py-2.5">
        <DashboardBrandHeader className="flex-1 min-w-0" switcherOpen={switcherOpen} onOpenSwitcher={openSwitcher} />
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="shrink-0 rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
          aria-expanded={mobileOpen}
          aria-controls="dashboard-mobile-nav"
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          aria-label={t("closeMenu")}
          onClick={closeMobile}
        />
      ) : null}
      <aside
        id="dashboard-mobile-nav"
        className={`md:hidden fixed inset-y-0 right-0 z-50 w-[min(18rem,85vw)] flex flex-col border-l border-white/10 bg-black/90 backdrop-blur-md p-4 transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-label={t("navAria")}
        aria-hidden={!mobileOpen}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <DashboardBrandHeader className="min-w-0 flex-1" switcherOpen={switcherOpen} onOpenSwitcher={openSwitcher} />
          <button
            type="button"
            onClick={closeMobile}
            className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label={t("closeMenu")}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <DashboardNav onNavigate={closeMobile} />
      </aside>

      <main className="flex-1 p-4 text-white md:p-8" role="main">
        {children}
      </main>

      <OrgSwitcherModal
        open={switcherOpen}
        onClose={closeSwitcher}
        activeOrgId={profile?.org_id ?? null}
        accountLabel={accountLabel}
      />
    </div>
  );
}
