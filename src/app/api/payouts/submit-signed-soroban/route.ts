import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getPayoutById, getPayoutByIdAsync, completePayout, failPayout, ensurePendingPayout } from "@/lib/payouts";
import { appendAuditEvent } from "@/lib/audit";
import { submitSignedSorobanEnvelope } from "@/lib/stellar/org-treasury";
import { formatSorobanPayoutError } from "@/lib/stellar/soroban-payout-errors";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

/**
 * POST /api/payouts/submit-signed-soroban
 * Submit passkey-signed Soroban disbursement payout.
 *
 * Body: { signedEnvelopeXdr: string, payoutId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user || (user.admin_level !== "super_admin" && user.admin_level !== "admin")) {
    return NextResponse.json({ error: "Only admins can submit Soroban payouts." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const signedEnvelopeXdr = typeof body.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : "";
  const payoutId = typeof body.payoutId === "string" ? body.payoutId.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const recipientLabel =
    typeof body.recipientLabel === "string" ? body.recipientLabel.trim() : undefined;

  if (!signedEnvelopeXdr || !payoutId) {
    return NextResponse.json({ error: "signedEnvelopeXdr and payoutId are required." }, { status: 400 });
  }

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);

  let payout = (await getPayoutByIdAsync(payoutId, session.id)) ?? getPayoutById(payoutId, session.id);
  if (!payout) {
    if (!amount || !destination) {
      const msg =
        locale === "es"
          ? "Retiro no encontrado (sesión del servidor reiniciada). Vuelve a intentar el envío desde Retiros."
          : "Payout not found (server session was reset). Please start the payout again from Payouts.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    payout = ensurePendingPayout(payoutId, session.id, amount, {
      type: "to_stellar",
      stellarAddress: destination,
      recipientLabel,
      orgId: user.org_id ?? null,
    });
  }
  if (payout.status !== "pending") {
    return NextResponse.json({ error: "Payout already completed or failed." }, { status: 400 });
  }

  const orgId = user.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 400 });

  const org = await getOrganizationForUser(orgId);
  if (!org?.soroban_contract_id) {
    return NextResponse.json({ error: "No Soroban disbursement contract." }, { status: 400 });
  }

  const memberSa = await getMemberSmartAccount(orgId, user.id);
  if (!memberSa) {
    return NextResponse.json({ error: "Member smart wallet not registered." }, { status: 403 });
  }

  try {
    const txHash = await submitSignedSorobanEnvelope(signedEnvelopeXdr, locale);
    completePayout(payoutId, txHash);
    appendAuditEvent(
      "payout_approved",
      `Soroban payout ${payout.amount} USDC (passkey signed by ${session.email ?? session.id})`,
      session.id,
      {
        signerWallet: memberSa.contract_id,
        amount: payout.amount,
        stellarTxHash: txHash,
        destination: payout.stellarAddress,
        recipientLabel: payout.recipientLabel,
      }
    );
    const updated = getPayoutById(payoutId, session.id);
    return NextResponse.json({ payout: { ...updated!, stellarTxHash: txHash } });
  } catch (err) {
    failPayout(payoutId);
    const raw = err instanceof Error ? err.message : "Soroban transaction failed";
    const msg = formatSorobanPayoutError(raw, locale);
    console.error("[payouts/submit-signed-soroban]", err instanceof Error ? err.stack : String(err));
    return NextResponse.json({ error: msg, payoutId }, { status: 502 });
  }
}
