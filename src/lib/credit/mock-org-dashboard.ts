/**
 * Demo metrics for /dashboard/credit (pool donut + summary cards + sample rows).
 * Toggle live API with NEXT_PUBLIC_CREDIT_DASHBOARD_MOCK=false when backend is ready.
 */

export type CreditPoolSegmentId =
  | "available"
  | "allocated"
  | "in_repayment"
  | "overdue";

export type MockPoolSegment = {
  id: CreditPoolSegmentId;
  amountUsd: number;
  /** Tailwind-friendly stroke (e.g. emerald-500) */
  colorClass: string;
};

/** Segments sum to total pool volume (demo). */
export const MOCK_CREDIT_POOL_TOTAL_USD = 520_000;

export const MOCK_CREDIT_POOL_SEGMENTS: MockPoolSegment[] = [
  { id: "available", amountUsd: 128_000, colorClass: "text-emerald-500" },
  { id: "allocated", amountUsd: 182_000, colorClass: "text-sky-500" },
  { id: "in_repayment", amountUsd: 175_000, colorClass: "text-violet-500" },
  { id: "overdue", amountUsd: 35_000, colorClass: "text-rose-500" },
];

export const MOCK_ORG_CREDIT_SUMMARY = {
  pendingApplicationCount: 5,
  activeLoanCount: 14,
  totalPrincipalDisbursed: 388_000,
  totalOutstandingApprox: 198_000,
  overdueApprox: 35_000,
  applicationCounts: {
    draft: 3,
    submitted: 5,
    approved: 8,
    rejected: 2,
  },
};

export type MockOrgLoanRow = {
  loan: { id: string; principal: number };
  applicantEmail: string;
  outstanding: number;
  nextDue: string | null;
  health: "on_track" | "at_risk" | "overdue";
};

export const MOCK_ORG_CREDIT_LOANS: MockOrgLoanRow[] = [
  {
    loan: { id: "mock-loan-1", principal: 4_200 },
    applicantEmail: "maria.gonzalez@example.org",
    outstanding: 1_850,
    nextDue: "2026-04-18",
    health: "on_track",
  },
  {
    loan: { id: "mock-loan-2", principal: 6_000 },
    applicantEmail: "coop.textiles@example.org",
    outstanding: 3_200,
    nextDue: "2026-04-12",
    health: "at_risk",
  },
  {
    loan: { id: "mock-loan-3", principal: 2_800 },
    applicantEmail: "lucia.ferreira@example.org",
    outstanding: 900,
    nextDue: "2026-03-28",
    health: "overdue",
  },
];

/** Stroke colors for SVG (match colorClass intent). */
export const MOCK_POOL_SEGMENT_STROKES: Record<CreditPoolSegmentId, string> = {
  available: "#10b981",
  allocated: "#0ea5e9",
  in_repayment: "#8b5cf6",
  overdue: "#f43f5e",
};
