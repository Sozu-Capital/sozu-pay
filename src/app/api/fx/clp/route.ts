import { NextResponse } from "next/server";
import { buildClpPricingQuote } from "@/lib/pos/clp-pricing";

/**
 * GET /api/fx/clp?amount=9500
 * Whole pesos → USDC settlement amount, same rule as POS checkout.
 */
export async function GET(request: Request) {
  const amount = new URL(request.url).searchParams.get("amount") ?? "";
  let frankfurterClpPerUsd: number | null = null;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=CLP", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: { CLP?: number } };
      const rate = data.rates?.CLP;
      if (typeof rate === "number" && rate > 0) frankfurterClpPerUsd = rate;
    }
  } catch {
    /* quote helper falls back to POS_CLP_PER_USDC or the pilot rate */
  }

  const quote = buildClpPricingQuote(amount, { frankfurterClpPerUsd });
  if (!quote) {
    return NextResponse.json(
      { error: "amount must be a positive whole-peso amount" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    amountClp: quote.amountClp,
    amountUsd: quote.amountUsd,
    clpPerUsdc: quote.clpPerUsdc,
  });
}
