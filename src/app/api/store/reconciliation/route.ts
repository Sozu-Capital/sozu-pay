import { NextResponse } from "next/server";
import { getDashboardWalletContext } from "@/lib/wallet-resolve-cached";
import { listCompletedCheckoutSessionsForOrg } from "@/lib/db/checkout-sessions";
import {
  parseClpAmount,
  reconciliationCsv,
  summarizeStoreReconciliation,
  type ReconciliationCharge,
} from "@/lib/store/reconciliation";

function chargesFromSessions(
  sessions: Awaited<ReturnType<typeof listCompletedCheckoutSessionsForOrg>>,
): ReconciliationCharge[] {
  return sessions.map((s) => ({
    id: s.id,
    amountClp: parseClpAmount(s.amount_clp),
    amountUsd: s.amount_usd,
    createdAt: s.created_at,
    completedAt: s.updated_at || s.created_at,
    stellarTxHash: s.stellar_tx_hash,
    reference: s.reference,
  }));
}

async function loadStoreSummary() {
  const ctx = await getDashboardWalletContext();
  if (!ctx.orgId || !ctx.org) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (ctx.org.type !== "store") {
    return { error: NextResponse.json({ error: "Store only." }, { status: 403 }) };
  }
  const sessions = await listCompletedCheckoutSessionsForOrg(ctx.orgId);
  const summary = summarizeStoreReconciliation(chargesFromSessions(sessions));
  return { summary };
}

export async function GET(request: Request) {
  const loaded = await loadStoreSummary();
  if ("error" in loaded && loaded.error) return loaded.error;
  const { summary } = loaded;
  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    return new NextResponse(reconciliationCsv(summary!), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sozu-store-reconciliation.csv"',
      },
    });
  }
  return NextResponse.json(summary);
}
