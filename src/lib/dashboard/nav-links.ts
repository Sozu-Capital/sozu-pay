export type DashboardNavKind =
  | "overview"
  | "transactions"
  | "pos"
  | "qr-codes"
  | "pay-supplier"
  | "cash-out"
  | "settings"
  | "profile"
  | "admin"
  | "payments-oracle"
  | "funding-links"
  | "disbursements"
  | "disbursement-history"
  | "recipients"
  | "send"
  | "people";

export type DashboardNavLink = {
  href: string;
  kind: DashboardNavKind;
  indent?: boolean;
};

export type StoreHomeActionKind = "pos" | "qr-codes" | "pay-supplier" | "cash-out";

export type StoreHomeAction = {
  href: string;
  kind: StoreHomeActionKind;
};

/** Store primary nav. POS is the only create-charge entry; Get paid / checkout is omitted. */
export function storeDashboardNavLinks(options: { isAdmin?: boolean } = {}): DashboardNavLink[] {
  const links: DashboardNavLink[] = [
    { href: "/dashboard", kind: "overview" },
    { href: "/dashboard/transactions", kind: "transactions" },
    { href: "/dashboard/pos", kind: "pos" },
    { href: "/dashboard/qr-codes", kind: "qr-codes" },
    { href: "/dashboard/recipients", kind: "pay-supplier" },
    { href: "/dashboard/cashout", kind: "cash-out" },
    { href: "/dashboard/settings", kind: "settings" },
    { href: "/dashboard/profile", kind: "profile" },
  ];
  if (options.isAdmin) {
    links.push(
      { href: "/dashboard/admin", kind: "admin", indent: true },
      { href: "/dashboard/admin/shadow-payments", kind: "payments-oracle", indent: true },
    );
  }
  return links;
}

/**
 * NGO primary nav — Send-first (format A):
 * Fund → Send (ad-hoc payouts) → People (address book) → optional Disbursements (SDP programs).
 */
export function ngoDashboardNavLinks(options: { showDisbursements?: boolean } = {}): DashboardNavLink[] {
  const links: DashboardNavLink[] = [
    { href: "/dashboard", kind: "overview" },
    { href: "/dashboard/checkout", kind: "funding-links" },
    { href: "/dashboard/payouts", kind: "send" },
    { href: "/dashboard/recipients", kind: "people", indent: true },
  ];
  if (options.showDisbursements) {
    links.push(
      { href: "/dashboard/disbursements", kind: "disbursements" },
      { href: "/dashboard/disbursements/history", kind: "disbursement-history", indent: true },
    );
  }
  links.push(
    { href: "/dashboard/transactions", kind: "transactions" },
    { href: "/dashboard/settings", kind: "settings" },
  );
  return links;
}

/** Store home quick actions. POS is the only create-charge tile. */
export function storeHomeActions(): StoreHomeAction[] {
  return [
    { href: "/dashboard/pos", kind: "pos" },
    { href: "/dashboard/qr-codes", kind: "qr-codes" },
    { href: "/dashboard/recipients", kind: "pay-supplier" },
    { href: "/dashboard/cashout", kind: "cash-out" },
  ];
}
