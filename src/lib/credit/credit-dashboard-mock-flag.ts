/**
 * When true (default), /dashboard/credit shows mock pool metrics + sample loans.
 * Set NEXT_PUBLIC_CREDIT_DASHBOARD_MOCK=false to use live /api/credit/org/* routes.
 */
export const CREDIT_DASHBOARD_USE_MOCK =
  process.env.NEXT_PUBLIC_CREDIT_DASHBOARD_MOCK !== "false";
