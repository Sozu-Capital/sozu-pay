"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useSignOut } from "@/lib/auth/useSignOut";

function NavLink({
  href,
  label,
  indent = false,
  onNavigate,
}: {
  href: string;
  label: string;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onNavigate}
      className={`block rounded-md text-sm font-medium ${
        indent ? "pl-6 pr-3 py-1.5" : "px-3 py-2"
      } ${
        isActive
          ? "text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {label}
    </Link>
  );
}

export function DashboardNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile } = useDashboardProfile() ?? { profile: null };
  const isAdmin =
    profile?.admin_level === "admin" || profile?.admin_level === "super_admin";
  const isStore = profile?.org_type === "store";
  const showDisbursementsNav = !isStore && !!profile?.org_id;
  const t = useTranslations("nav");
  const { signOut, signingOut } = useSignOut();

  const linkProps = { onNavigate };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1">
        <NavLink href="/dashboard" label={t("overview")} {...linkProps} />
        {isStore ? (
          <>
            <NavLink href="/dashboard/transactions" label={t("transactions")} {...linkProps} />
            <NavLink href="/dashboard/checkout" label={t("getPaid")} {...linkProps} />
            <NavLink href="/dashboard/pos" label={t("posNfc")} {...linkProps} />
            <NavLink href="/dashboard/qr-codes" label={t("qrAndNfc")} {...linkProps} />
            <NavLink href="/dashboard/recipients" label={t("paySupplier")} {...linkProps} />
            <NavLink href="/dashboard/cashout" label={t("cashOut")} {...linkProps} />
            <NavLink href="/dashboard/settings" label={t("settings")} {...linkProps} />
            <NavLink href="/dashboard/profile" label={t("profile")} {...linkProps} />
            {isAdmin && <NavLink href="/dashboard/admin" label={t("admin")} indent {...linkProps} />}
            {isAdmin && (
              <NavLink
                href="/dashboard/admin/shadow-payments"
                label={t("paymentsOracle")}
                indent
                {...linkProps}
              />
            )}
          </>
        ) : (
          <>
            {/* NGO dashboard v1 primary nav */}
            <NavLink href="/dashboard/checkout" label={t("fundingLinks")} {...linkProps} />
            {showDisbursementsNav && (
              <>
                <NavLink href="/dashboard/disbursements" label={t("disbursements")} {...linkProps} />
                <NavLink
                  href="/dashboard/disbursements/history"
                  label={t("disbursementHistory")}
                  indent
                  {...linkProps}
                />
              </>
            )}
            <NavLink href="/dashboard/recipients" label={t("recipients")} {...linkProps} />
            <NavLink href="/dashboard/transactions" label={t("transactions")} {...linkProps} />
            <NavLink href="/dashboard/settings" label={t("settings")} {...linkProps} />
          </>
        )}
      </nav>
      <div className="mt-auto pt-4 border-t border-white/10 shrink-0">
        <LanguageSwitcher className="mb-3" />
        <div className="flex items-center justify-between min-h-[36px]">
          {isStore ? (
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
              {t("merchant")}
            </span>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => signOut()}
            disabled={signingOut}
            className="flex items-center justify-center p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
            aria-label={t("logOut")}
          >
            <span className="sr-only">{t("logOut")}</span>
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
