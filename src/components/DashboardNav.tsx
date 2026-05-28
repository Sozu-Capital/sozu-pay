"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function NavLink({
  href,
  label,
  indent = false,
}: {
  href: string;
  label: string;
  indent?: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      prefetch={true}
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

export function DashboardNav() {
  const { profile } = useDashboardProfile() ?? { profile: null };
  const isAdmin =
    profile?.admin_level === "admin" || profile?.admin_level === "super_admin";
  const isStore = profile?.org_type === "store";
  const t = useTranslations("nav");

  return (
    <nav className="mt-6 flex flex-col flex-1 min-h-0">
      <div className="space-y-1">
        <NavLink href="/dashboard" label={t("overview")} />
        <NavLink href="/dashboard/transactions" label={t("transactions")} />
        {isStore ? (
          <>
            <NavLink href="/dashboard/checkout" label={t("getPaid")} />
            <NavLink href="/dashboard/recipients" label={t("paySupplier")} />
            <NavLink href="/dashboard/cashout" label={t("cashOut")} />
            <NavLink href="/dashboard/profile" label={t("profile")} />
            {isAdmin && <NavLink href="/dashboard/admin" label={t("admin")} indent />}
            {isAdmin && (
              <NavLink
                href="/dashboard/admin/shadow-payments"
                label={t("paymentsOracle")}
                indent
              />
            )}
          </>
        ) : (
          <>
            <NavLink href="/dashboard/audit" label={t("auditLog")} indent />
            <NavLink href="/dashboard/vault" label={t("vault")} />
            <NavLink href="/dashboard/credit" label={t("credit")} />
            {isAdmin && (
              <NavLink
                href="/dashboard/credit-applications"
                label={t("creditApplications")}
                indent
              />
            )}
            <NavLink href="/dashboard/walls" label={t("paymentWalls")} />
            <NavLink href="/dashboard/payouts" label={t("payouts")} />
            <NavLink href="/dashboard/disbursements" label={t("disbursements")} />
            <NavLink href="/dashboard/payments" label={t("paymentsPoc")} />
            <NavLink href="/dashboard/recipients" label={t("recipients")} />
            <NavLink href="/dashboard/profile" label={t("profile")} />
            {isAdmin && <NavLink href="/dashboard/admin" label={t("admin")} indent />}
            {isAdmin && (
              <NavLink
                href="/dashboard/admin/shadow-payments"
                label={t("paymentsOracle")}
                indent
              />
            )}
            <NavLink href="/dashboard/keys" label={t("keysCustody")} indent />
          </>
        )}
      </div>
      <div className="mt-auto pt-4 border-t border-white/10">
        <LanguageSwitcher className="mb-3" />
        <form action="/api/auth/logout" method="POST" className="block">
          <button
            type="submit"
            className="w-full flex items-center justify-end gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
            aria-label={t("logOut")}
          >
            <span className="sr-only">{t("logOut")}</span>
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </form>
      </div>
    </nav>
  );
}
