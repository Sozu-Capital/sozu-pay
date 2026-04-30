import type { CreditSimulation, SimulationInstallment } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * French amortization (fixed monthly cuota). TNA is annual nominal %; monthly rate = TNA/12/100.
 */
export function frenchAmortizationSchedule(params: {
  principal: number;
  annualRatePct: number;
  numInstallments: number;
}): CreditSimulation {
  const { principal: P, annualRatePct, numInstallments: n } = params;
  if (P <= 0 || n <= 0) {
    throw new Error("principal and numInstallments must be positive");
  }

  const r = annualRatePct / 100 / 12;
  const installments: SimulationInstallment[] = [];

  if (r === 0) {
    const pay = round2(P / n);
    let balance = P;
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      const principalPart = isLast ? balance : round2(pay);
      const interestPart = 0;
      balance = round2(balance - principalPart);
      installments.push({
        index: i,
        principal: principalPart,
        interest: interestPart,
        payment: round2(principalPart + interestPart),
        balanceAfter: Math.max(0, balance),
      });
    }
    const totalPayment = round2(
      installments.reduce((s, x) => s + x.payment, 0)
    );
    return {
      principal: P,
      annualRatePct,
      numInstallments: n,
      paymentAmount: round2(P / n),
      totalInterest: 0,
      totalPayment,
      installments,
    };
  }

  const pow = (1 + r) ** n;
  const M = (P * r * pow) / (pow - 1);
  let balance = P;
  let totalInterest = 0;

  for (let i = 1; i <= n; i++) {
    const interest = round2(balance * r);
    let principal = round2(M - interest);
    if (i === n) {
      principal = round2(balance);
    }
    const payment = round2(principal + interest);
    balance = round2(balance - principal);
    if (balance < 0) balance = 0;
    totalInterest += interest;
    installments.push({
      index: i,
      principal,
      interest,
      payment,
      balanceAfter: balance,
    });
  }

  totalInterest = round2(totalInterest);
  const totalPayment = round2(
    installments.reduce((s, x) => s + x.payment, 0)
  );

  return {
    principal: P,
    annualRatePct,
    numInstallments: n,
    paymentAmount: round2(M),
    totalInterest,
    totalPayment,
    installments,
  };
}
