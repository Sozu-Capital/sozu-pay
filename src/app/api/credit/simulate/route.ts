import { NextResponse } from "next/server";
import { frenchAmortizationSchedule } from "@/lib/credit/amortization";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      principal?: number;
      annualRatePct?: number;
      numInstallments?: number;
    };
    const principal = Number(body.principal);
    const annualRatePct = Number(body.annualRatePct);
    const numInstallments = Number(body.numInstallments);
    if (
      !Number.isFinite(principal) ||
      !Number.isFinite(annualRatePct) ||
      !Number.isFinite(numInstallments)
    ) {
      return NextResponse.json({ error: "Invalid numbers" }, { status: 400 });
    }
    const sim = frenchAmortizationSchedule({
      principal,
      annualRatePct,
      numInstallments,
    });
    return NextResponse.json({ simulation: sim });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Simulation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
