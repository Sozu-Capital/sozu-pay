export type CreditApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export type InstallmentScheduleRowStatus =
  | "pending"
  | "partial"
  | "paid"
  | "late";

export type SimulationInstallment = {
  index: number;
  principal: number;
  interest: number;
  payment: number;
  balanceAfter: number;
};

export type CreditSimulation = {
  principal: number;
  annualRatePct: number;
  numInstallments: number;
  paymentAmount: number;
  totalInterest: number;
  totalPayment: number;
  installments: SimulationInstallment[];
};
