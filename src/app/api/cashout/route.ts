import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getOrgTreasuryUsdcBalance } from "@/lib/org-receive-address";
import {
  createWithdrawalRequest,
  getActivePendingWithdrawalForOrg,
  listWithdrawalRequestsForOrg,
} from "@/lib/db/withdrawal-requests";
import {
  arsCentsFor,
  canonicalEscrowAccount,
  canonicalSmartAccount,
  effectiveDeskTotalMinor,
  normalizeDeskBankAlias,
  readDeskCaps,
  usdcStringToMinor,
} from "@/lib/desk/merchant-request";
import {
  createDeskOrder,
  deskOrderBlocksAnother,
  listDeskOrdersForUser,
  quoteDeskArs,
} from "@/lib/desk/merchant-desk-store";

/**
 * GET /api/cashout – list recent withdrawal requests for the authenticated org.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ withdrawals: [] });

  const [withdrawals, deskOrders] = await Promise.all([
    listWithdrawalRequestsForOrg(orgId, 20),
    listDeskOrdersForUser(session.id),
  ]);
  const deskRows = deskOrders.map((order) => ({
    id: order.id,
    status: deskOrderBlocksAnother(order.status)
      ? "pending"
      : order.status === "released"
        ? "completed"
        : order.status === "refunded" || order.status === "expired"
          ? "cancelled"
          : order.status,
    amount_usd: (order.usdc_minor / 10_000_000).toFixed(2),
    bank_account_holder: order.bank_alias,
    bank_country: "",
    bank_account_number: order.bank_alias,
    bank_currency: "ARS",
    estimated_arrival: null,
    fiat_sent_at: null,
    created_at: order.created_at,
    kind: "desk",
  }));
  const merged = [...withdrawals, ...deskRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return NextResponse.json({ withdrawals: merged });
}

/**
 * POST /api/cashout
 * Opens a P2P desk order for this store (USDC sold to the desk, pesos to the bank alias).
 * Body: { amountUsd, bankAccountHolder, bankCountry, bankAccountNumber, attested: true }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountUsd = typeof body.amountUsd === "string" ? body.amountUsd.trim() : "";
  const bankAccountHolder = typeof body.bankAccountHolder === "string" ? body.bankAccountHolder.trim() : "";
  const bankCountry = typeof body.bankCountry === "string" ? body.bankCountry.trim().toUpperCase() : "";
  const bankAccountNumber = typeof body.bankAccountNumber === "string" ? body.bankAccountNumber.trim() : "";
  const bankCurrency = typeof body.bankCurrency === "string" ? body.bankCurrency.trim().toUpperCase() : "";
  const bankRoutingCode = typeof body.bankRoutingCode === "string" ? body.bankRoutingCode.trim() : "";
  const deskPayout = bankCountry === "AR" && bankCurrency === "ARS";

  const amount = parseFloat(amountUsd);
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 });
  }
  if (!bankAccountHolder || !bankCountry || !bankAccountNumber) {
    return NextResponse.json({ error: "bankAccountHolder, bankCountry, and bankAccountNumber are required" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const org = await getOrganizationForUser(orgId);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { address: sourceAddress, balance: balanceUsdc } = await getOrgTreasuryUsdcBalance(org);
  if (!sourceAddress) {
    return NextResponse.json({ error: "Organization has no Stellar wallet" }, { status: 422 });
  }

  const activePending = await getActivePendingWithdrawalForOrg(orgId);
  if (activePending) {
    return NextResponse.json(
      { error: "Cancel your pending withdrawal before requesting a new one", code: "pending_exists" },
      { status: 409 },
    );
  }

  if (parseFloat(balanceUsdc) < amount) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: ${balanceUsdc} USDC` },
      { status: 422 },
    );
  }

  if (body.attested !== true) {
    return NextResponse.json(
      { error: "Confirm the bank account is in your name", code: "attestation_required" },
      { status: 400 },
    );
  }

  if (!deskPayout) {
    if (bankCountry === "AR" || bankCurrency === "ARS") {
      return NextResponse.json(
        { error: "The P2P desk pays Argentine pesos to an Argentine account. Choose AR and ARS together." },
        { status: 400 },
      );
    }
    const id = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const row = await createWithdrawalRequest({
      id,
      orgId,
      amountUsd,
      sourceStellarAddress: sourceAddress,
      bankAccountHolder,
      bankCountry,
      bankAccountNumber,
      bankRoutingCode: bankRoutingCode || undefined,
      bankCurrency: bankCurrency || undefined,
      providerWithdrawalId: id,
    });
    return NextResponse.json({
      id: row.id,
      status: row.status,
      kind: "bank",
      bankCurrency: row.bank_currency,
      estimatedArrival: row.estimated_arrival,
    });
  }

  const bankAlias = normalizeDeskBankAlias(bankAccountNumber);
  if (!bankAlias) {
    return NextResponse.json(
      { error: "Enter a bank alias or account number (6–64 characters, no spaces)", code: "invalid_bank_alias" },
      { status: 400 },
    );
  }

  const usdcMinor = usdcStringToMinor(amountUsd);
  if (usdcMinor == null) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 });
  }

  const smartAccount = canonicalSmartAccount(
    org.treasury_smart_account_address || org.treasury_contract_id || org.soroban_contract_id,
  );
  if (!smartAccount) {
    return NextResponse.json(
      { error: "This store wallet cannot open a P2P desk request yet", code: "wallet_must_be_smart_account" },
      { status: 422 },
    );
  }

  const escrowAddress = canonicalEscrowAccount(process.env.DESK_ESCROW_ADDRESS);
  const caps = readDeskCaps();
  if (!escrowAddress || !caps) {
    return NextResponse.json(
      { error: "P2P desk is not configured", code: "desk_not_configured" },
      { status: 503 },
    );
  }

  const quote = await quoteDeskArs();
  if ("error" in quote) {
    return NextResponse.json({ error: quote.error, code: "quote_unavailable" }, { status: 503 });
  }

  const existingDesk = await listDeskOrdersForUser(session.id);
  if (existingDesk.some((order) => deskOrderBlocksAnother(order.status))) {
    return NextResponse.json(
      { error: "Cancel your pending withdrawal before requesting a new one", code: "pending_exists" },
      { status: 409 },
    );
  }

  const created = await createDeskOrder({
    userId: session.id,
    smartAccount,
    escrowAddress,
    usdcMinor,
    arsCents: arsCentsFor(usdcMinor, quote.rate),
    rate: quote.rate,
    rateSource: quote.source,
    rateAt: quote.at,
    bankAlias,
    capPerOrderMinor: caps.perOrderMinor,
    capPerPersonMinor: caps.perPersonMinor,
    capTotalMinor: effectiveDeskTotalMinor(caps, quote.rate),
  });
  if (!created.ok) {
    const code = created.error.includes("desk_cap_")
      ? created.error.match(/desk_cap_[a-z_]+/)?.[0] ?? "desk_cap"
      : "desk_create_failed";
    console.error("[cashout] desk request:", created.error);
    return NextResponse.json({ error: "Could not create the P2P desk request", code }, { status: 422 });
  }

  return NextResponse.json({
    id: created.id,
    status: created.status,
    kind: "desk",
    bankCurrency: "ARS",
    rate: quote.rate,
    arsCents: arsCentsFor(usdcMinor, quote.rate),
    estimatedArrival: null,
  });
}
