import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Keypair } from "@stellar/stellar-sdk";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { createPayout, listPayouts, completePayout, failPayout } from "@/lib/payouts";
import { getRecipient } from "@/lib/recipients";
import { appendAuditEvent } from "@/lib/audit";
import { sendUsdc, getOrgDisbursementPublicKey } from "@/lib/stellar/sendUsdc";
import { sendPizzaToken } from "@/lib/stellar/send-pizza";
import { getPizzaTokenId, isPizzaTokenConfigured } from "@/lib/stellar/pizza-token";
import { parsePayoutAsset, parsePizzaSendAmount, pizzaSendAmountI128, type PayoutAsset } from "@/lib/payouts/asset";
import { fundClassicAccount, ensureSpendableXlmForFees } from "@/lib/stellar/fund";
import { invokeSorobanPayout } from "@/lib/stellar/sorobanPayout";
import { UNLOCK_COOKIE_NAME, getUnlockedKey, getUnlockedKeyFromCookie } from "@/lib/auth/wallet-unlock";
import { decryptOrgSecret } from "@/lib/org-secret";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { buildUnsignedUsdcEnvelope } from "@/lib/stellar/sendUsdc";
import type { Organization } from "@/lib/db/organizations";
import { resolvePaymentRecipient } from "@/lib/payment/resolve-recipient";
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address";
import { payoutRailForDestination } from "@/lib/payment/payout-rail";
import { getCircleUsdcSacContractId } from "@/lib/stellar/org-treasury";
import { createOrgSpendExecutor } from "@/lib/pollar/spend";
import {
  resolveHomeTreasurySigner,
  usesPollarHomeTreasury,
  type HomeTreasurySignerResult,
} from "@/lib/payouts/home-treasury-signer";

/** Derive signer public key for audit log. */
function getSignerPublicKey(
  signerSecretKey: string | undefined,
  org: Organization | null,
  fromAddress?: string,
): string | undefined {
  if (signerSecretKey) return Keypair.fromSecret(signerSecretKey).publicKey();
  if (fromAddress?.startsWith("G")) return fromAddress;
  return org?.stellar_disbursement_public_key ?? getOrgDisbursementPublicKey() ?? undefined;
}

function getOrgStoredSignerSecret(org: Organization | null): string | undefined {
  if (!org?.stellar_disbursement_secret_encrypted) return undefined;
  if (isUserDerivedEncrypted(org.stellar_disbursement_secret_encrypted)) return undefined;
  try {
    return decryptOrgSecret(org.id, org.stellar_disbursement_secret_encrypted);
  } catch {
    return undefined;
  }
}

function resolveSignerForRequest(
  sessionId: string,
  cookieValue: string | null | undefined,
  org: Organization | null,
  user: { privy_user_id: string; stellar_public_key?: string | null } | null,
): HomeTreasurySignerResult {
  const unlocked =
    getUnlockedKey(sessionId) ?? getUnlockedKeyFromCookie(cookieValue) ?? undefined;
  return resolveHomeTreasurySigner({
    org,
    pollarHomeTreasury: usesPollarHomeTreasury(user, org),
    orgStoredSecret: getOrgStoredSignerSecret(org),
    unlockedSecret: unlocked,
    sessionPublicKey: user?.stellar_public_key,
  });
}

async function executePollarFakePayout(
  fromAddress: string,
  destination: string,
  amount: string,
  actingUserId: string,
  paymentId: string,
): Promise<string> {
  const executor = createOrgSpendExecutor();
  const result = await executor.execute({
    fromAddress,
    actingUserId,
    payments: [{ paymentId, toAddress: destination, amount }],
  });
  const hash = result.txHashes[0];
  if (!hash) throw new Error("Org treasury spend returned no transaction hash");
  return hash;
}

async function pollarClientTxResponse(params: {
  payoutId: string;
  amount: string;
  destination: string;
  recipientLabel?: string;
  fromAddress: string;
  asset?: PayoutAsset;
}) {
  // Pollar custodial wallets often have USDC but 0 spendable XLM (reserves / deferred funding).
  // Top up from STELLAR_FUNDER before asking the client to sign.
  const feeEnsure = await ensureSpendableXlmForFees(params.fromAddress);
  if (feeEnsure.error) {
    console.warn("[payouts] ensure fee XLM failed:", feeEnsure.error, params.fromAddress);
  } else if (feeEnsure.toppedUp) {
    console.log("[payouts] topped up fee XLM:", {
      address: params.fromAddress.slice(0, 8),
      method: feeEnsure.method,
      spendableAfter: feeEnsure.xlmSpendableAfter,
    });
  }

  const asset: PayoutAsset = params.asset === "PIZZA" ? "PIZZA" : "USDC";
  const rail = asset === "PIZZA" ? "sac" : (payoutRailForDestination(params.destination) ?? "classic");
  const pizzaTokenId = asset === "PIZZA" ? getPizzaTokenId() : undefined;
  return NextResponse.json(
    {
      error: "Confirm this payout with your Pollar session (Home treasury).",
      requirePollarClientTx: true,
      payoutId: params.payoutId,
      amount: params.amount,
      destination: params.destination,
      recipientLabel: params.recipientLabel,
      fromAddress: params.fromAddress,
      asset,
      rail,
      sacContractId:
        asset === "PIZZA"
          ? pizzaTokenId
          : rail === "sac"
            ? getCircleUsdcSacContractId()
            : undefined,
      amountI128: asset === "PIZZA" ? pizzaSendAmountI128(params.amount) : undefined,
      feeXlm: {
        toppedUp: feeEnsure.toppedUp,
        spendable: feeEnsure.xlmSpendableAfter,
        error: feeEnsure.error,
      },
    },
    { status: 403 },
  );
}

/** Try sendUsdc from org wallet; if org wallet doesn't exist on network, fund it (when STELLAR_FUNDER_SECRET is set) and retry once. */
async function sendUsdcWithAutoFund(
  destination: string,
  amount: string,
  signerSecretKey?: string
): Promise<string> {
  const opts = signerSecretKey ? { signerSecretKey } : undefined;
  try {
    return await sendUsdc(destination, amount, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const needsFund =
      msg.includes("does not exist") ||
      msg.includes("Not Found") ||
      msg.includes("404");
    if (!needsFund || !process.env.STELLAR_FUNDER_SECRET?.trim()) {
      throw err;
    }
    const accountToFund = signerSecretKey
      ? Keypair.fromSecret(signerSecretKey).publicKey()
      : getOrgDisbursementPublicKey();
    if (!accountToFund) throw err;
    await fundClassicAccount(accountToFund);
    return await sendUsdc(destination, amount, opts);
  }
}

/**
 * Execute one Stellar payout: Soroban contract if org has soroban_contract_id, else Classic sendUsdc.
 * For Soroban, signerSecretKey is required. For Classic, signerSecretKey is optional (env org key fallback).
 */
async function executeStellarPayout(
  destination: string,
  amount: string,
  signerSecretKey: string | undefined,
  sorobanContractId: string | null
): Promise<string> {
  if (sorobanContractId?.trim() && signerSecretKey) {
    return invokeSorobanPayout({
      contractId: sorobanContractId.trim(),
      signerSecretKey,
      recipientAddress: destination,
      amount,
    });
  }
  return sendUsdcWithAutoFund(destination, amount, signerSecretKey);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const payouts = await listPayouts(session.id, limit);
  return NextResponse.json({ payouts });
}

type SinglePayoutInput =
  | { amount: string; recipientId: string }
  | { amount: string; bankAccountId?: string; stellarAddress?: string; recipientLabel?: string };

async function normalizeSingle(
  sessionId: string,
  item: SinglePayoutInput
): Promise<{ amount: string; type: "to_bank" | "to_stellar"; bankAccountId?: string; stellarAddress?: string; recipientLabel?: string; recipientId?: string } | null> {
  const amount = typeof (item as { amount: unknown }).amount === "string" ? (item as { amount: string }).amount : "0";
  if ("recipientId" in item && typeof item.recipientId === "string") {
    const rec = await getRecipient(item.recipientId, sessionId);
    if (!rec) return null;
    const hasStellar = !!rec.stellarAddress && !rec.bankAccountId;
    if (hasStellar) {
      return { amount, type: "to_stellar", stellarAddress: rec.stellarAddress, recipientLabel: rec.name, recipientId: rec.id };
    }
    if (rec.bankAccountId) {
      return { amount, type: "to_bank", bankAccountId: rec.bankAccountId, recipientLabel: rec.name, recipientId: rec.id };
    }
    return null;
  }
  const rest = item as { bankAccountId?: string; stellarAddress?: string; recipientLabel?: string };
  if (rest.stellarAddress) {
    return { amount, type: "to_stellar", stellarAddress: rest.stellarAddress, recipientLabel: rest.recipientLabel };
  }
  if (rest.bankAccountId) {
    return { amount, type: "to_bank", bankAccountId: rest.bankAccountId, recipientLabel: rest.recipientLabel };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySessionId(session.id);
    const orgId = session.orgId ?? user?.org_id ?? null;
    const canStellarPayout =
      user?.admin_level === "super_admin" || user?.admin_level === "admin";

    const body = await request.json().catch(() => ({}));

    if (Array.isArray(body.payouts) && body.payouts.length > 0) {
    const results: { payout: ReturnType<typeof createPayout> }[] = [];
    const normalized: Awaited<ReturnType<typeof normalizeSingle>>[] = [];
    for (const item of body.payouts as SinglePayoutInput[]) {
      const n = await normalizeSingle(session.id, item);
      if (!n) {
        return NextResponse.json(
          { error: "Invalid payout item: need recipientId or bankAccountId/stellarAddress" },
          { status: 400 }
        );
      }
      normalized.push(n);
    }
    const hasStellarInBatch = normalized.some((n) => n != null && n.type === "to_stellar");
    let stellarSignerSecretKey: string | undefined;
    let orgSorobanContractId: string | null = null;
    let batchOrg: Organization | null = null;
    let batchSignerMode: HomeTreasurySignerResult["mode"] | undefined;
    let batchFromAddress: string | undefined;
    if (hasStellarInBatch) {
      if (!canStellarPayout) {
        return NextResponse.json(
          { error: "Only admins can perform Stellar payouts." },
          { status: 403 }
        );
      }
      const org = orgId ? await getOrganizationForUser(orgId) : null;
      batchOrg = org;
      orgSorobanContractId = org?.soroban_contract_id ?? null;
      if (orgSorobanContractId) {
        return NextResponse.json(
          {
            error:
              "Batch Stellar payouts with Soroban treasury require passkey signing one recipient at a time.",
            code: "SOROBAN_BATCH_NOT_SUPPORTED",
          },
          { status: 400 }
        );
      }
      const cookieStore = await cookies();
      const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
      const signer = resolveSignerForRequest(session.id, unlockCookie, org, user);
      if (signer.requirePayoutPassword) {
        return NextResponse.json(
          { error: "Your org wallet uses a payout password. Send Stellar payouts one at a time from Recipients or Payouts; you will be prompted for your payout password.", requireUnlock: true },
          { status: 403 }
        );
      }
      if (signer.mode === "pollar_client") {
        return NextResponse.json(
          {
            error:
              "Pollar Home treasury payouts must be sent one at a time so the treasury owner can confirm in Pollar.",
            code: "POLLAR_BATCH_CLIENT_TX",
          },
          { status: 400 },
        );
      }
      if (orgSorobanContractId && !signer.signerSecretKey) {
        return NextResponse.json(
          { error: "Unlock your payout wallet to send Soroban payouts.", requireUnlock: true },
          { status: 403 }
        );
      }
      if (signer.requireUnlock) {
        return NextResponse.json(
          { error: "Unlock your payout wallet to send Stellar payouts.", requireUnlock: true },
          { status: 403 }
        );
      }
      stellarSignerSecretKey = signer.signerSecretKey;
      batchSignerMode = signer.mode;
      batchFromAddress = signer.fromAddress;
      if (
        !stellarSignerSecretKey &&
        signer.mode !== "legacy_env" &&
        signer.mode !== "pollar_fake" &&
        !org?.stellar_disbursement_public_key &&
        !getOrgDisbursementPublicKey()
      ) {
        return NextResponse.json(
          { error: "Org disbursement wallet not configured. Create an organization with a wallet or set ORG_DISBURSEMENT_SECRET in env." },
          { status: 503 }
        );
      }
    }
    const batchSignerWallet = hasStellarInBatch
      ? getSignerPublicKey(stellarSignerSecretKey, batchOrg, batchFromAddress)
      : undefined;
    for (const n of normalized) {
      if (!n) continue;
      const record = createPayout(session.id, n.amount, {
        type: n.type,
        bankAccountId: n.bankAccountId,
        stellarAddress: n.stellarAddress,
        recipientLabel: n.recipientLabel,
        orgId,
      });
      if (n.type === "to_stellar" && n.stellarAddress) {
        try {
          let txHash: string;
          if (batchSignerMode === "pollar_fake" && batchFromAddress) {
            txHash = await executePollarFakePayout(
              batchFromAddress,
              n.stellarAddress,
              n.amount,
              String(user?.id ?? session.id),
              record.id,
            );
          } else {
            txHash = await executeStellarPayout(
              n.stellarAddress,
              n.amount,
              stellarSignerSecretKey,
              orgSorobanContractId
            );
          }
          completePayout(record.id, txHash);
          appendAuditEvent(
            "payout_approved",
            `Payout ${n.amount} USDC to ${n.recipientLabel ?? n.stellarAddress} (approved by ${session.email ?? session.id})`,
            session.id,
            {
              signerWallet: batchSignerWallet,
              recipientId: n.recipientId,
              amount: n.amount,
              stellarTxHash: txHash,
              destination: n.stellarAddress,
              recipientLabel: n.recipientLabel,
            }
          );
        } catch (err) {
          failPayout(record.id);
          const msg = err instanceof Error ? err.message : "Stellar payment failed";
          return NextResponse.json(
            { error: `Payout failed: ${msg}`, payoutId: record.id },
            { status: 502 }
          );
        }
      }
      results.push({ payout: record });
      if (n.type !== "to_stellar") {
        appendAuditEvent("payout", `Payout: ${n.recipientLabel ?? n.stellarAddress ?? n.bankAccountId}`, session.id);
      }
    }
    return NextResponse.json({ payouts: results.map((r) => r.payout) });
  }

  const amount = typeof body.amount === "string" ? body.amount : "0";
  let asset: PayoutAsset;
  try {
    asset = parsePayoutAsset(body.asset);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unsupported payout asset" },
      { status: 400 },
    );
  }

  if (body.toStellar === true && typeof body.destination === "string") {
    if (!canStellarPayout) {
      return NextResponse.json(
        { error: "Only admins can perform Stellar payouts." },
        { status: 403 }
      );
    }
    const org = orgId ? await getOrganizationForUser(orgId) : null;
    const sorobanContractId = org?.soroban_contract_id ?? null;
    const cookieStore = await cookies();
    const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
    const signer = resolveSignerForRequest(session.id, unlockCookie, org, user);
    const { signerSecretKey, requireUnlock, requirePayoutPassword } = signer;

    let destination = body.destination.trim();
    let recipientLabel =
      typeof body.recipientLabel === "string" ? body.recipientLabel.trim() : undefined;

    if (!isValidStellarReceiveAddress(destination)) {
      console.log("[payouts] Resolving recipient:", { raw: destination });
      const resolved = await resolvePaymentRecipient(destination);
      if (!resolved.ok) {
        console.error("[payouts] Resolution failed:", {
          raw: destination,
          error: resolved.error,
          status: resolved.status,
        });
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      console.log("[payouts] Resolved to:", {
        walletAddress: resolved.recipient.walletAddress,
        tag: resolved.recipient.tag,
        rail: resolved.recipient.paymentRail,
      });
      destination = resolved.recipient.walletAddress;
      if (!recipientLabel && resolved.recipient.tag) {
        recipientLabel = `$${resolved.recipient.tag.replace(/^\$+/, "")}`;
      }
    }

    if (asset === "PIZZA") {
      if (!isPizzaTokenConfigured()) {
        return NextResponse.json(
          { error: "PIZZA token is not configured on this server." },
          { status: 400 },
        );
      }
      try {
        parsePizzaSendAmount(amount);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "PIZZA amount must be a whole number of at least 1" },
          { status: 400 },
        );
      }
    }

    const record = createPayout(session.id, amount, {
      type: "to_stellar",
      stellarAddress: destination,
      recipientLabel,
      orgId,
      asset,
    });

    /** Pizza is SEP-41 — never the org USDC disbursement contract. */
    if (sorobanContractId && asset !== "PIZZA") {
      if (!orgId || !user) {
        failPayout(record.id);
        return NextResponse.json({ error: "No organization." }, { status: 400 });
      }
      const memberSa = await getMemberSmartAccount(orgId, user.id);
      if (!memberSa) {
        failPayout(record.id);
        return NextResponse.json(
          {
            error: "Set up your passkey smart wallet first.",
            code: "MEMBER_SMART_WALLET_REQUIRED",
            setupUrl: "/onboarding/setup-smart-wallet",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({
        requirePasskeySign: true,
        payoutId: record.id,
        amount,
        destination,
        recipientLabel,
        disbursementContractId: sorobanContractId,
        callerSmartAccountId: memberSa.contract_id,
      });
    }

    if (requirePayoutPassword && org?.stellar_disbursement_public_key) {
      if (asset === "PIZZA") {
        failPayout(record.id);
        return NextResponse.json(
          {
            error:
              "Sending PIZZA requires the Home treasury Pollar session (or an unlocked payout wallet). Payout password signing is USDC-only.",
            code: "PIZZA_PAYOUT_PASSWORD_UNSUPPORTED",
          },
          { status: 400 },
        );
      }
      if (destination.trim().toUpperCase().startsWith("C")) {
        failPayout(record.id);
        return NextResponse.json(
          {
            error:
              "Sending to a smart account (C…) requires the org treasury to sign a SAC transfer. Unlock the payout wallet (or use a classic G destination).",
            code: "SAC_PAYOUT_PASSWORD_UNSUPPORTED",
          },
          { status: 400 }
        );
      }
      try {
        const { envelopeXdr, network } = await buildUnsignedUsdcEnvelope(
          org.stellar_disbursement_public_key,
          destination,
          amount
        );
        return NextResponse.json(
          {
            error: "Enter your payout password to sign this transaction.",
            requireUnlock: true,
            requirePayoutPassword: true,
            payoutId: record.id,
            unsignedEnvelopeXdr: envelopeXdr,
            network,
            amount,
            destination,
            recipientLabel,
          },
          { status: 403 }
        );
      } catch (err) {
        failPayout(record.id);
        const msg = err instanceof Error ? err.message : "Failed to build transaction";
        return NextResponse.json(
          { error: `Payout failed: ${msg}`, payoutId: record.id },
          { status: 502 }
        );
      }
    }

    if (signer.mode === "pollar_client" && signer.fromAddress) {
      // Keep pending record; client signs with Pollar session then POST /complete-client.
      return await pollarClientTxResponse({
        payoutId: record.id,
        amount,
        destination,
        recipientLabel,
        fromAddress: signer.fromAddress,
        asset,
      });
    }

    if (requireUnlock) {
      failPayout(record.id);
      return NextResponse.json(
        { error: "Unlock your payout wallet to send Stellar payouts.", requireUnlock: true },
        { status: 403 }
      );
    }
    if (
      !signerSecretKey &&
      signer.mode !== "legacy_env" &&
      signer.mode !== "pollar_fake" &&
      !org?.stellar_disbursement_public_key &&
      !getOrgDisbursementPublicKey()
    ) {
      failPayout(record.id);
      return NextResponse.json(
        { error: "Org disbursement wallet not configured. Create an organization with a treasury or set ORG_DISBURSEMENT_SECRET in env." },
        { status: 503 }
      );
    }
    try {
      let txHash: string;
      if (signer.mode === "pollar_fake" && signer.fromAddress) {
        txHash = await executePollarFakePayout(
          signer.fromAddress,
          destination,
          amount,
          String(user?.id ?? session.id),
          record.id,
        );
      } else if (asset === "PIZZA") {
        txHash = await sendPizzaToken(destination, amount, signerSecretKey);
      } else {
        txHash = await executeStellarPayout(
          destination,
          amount,
          signerSecretKey,
          sorobanContractId
        );
      }
      completePayout(record.id, txHash);
      const signerWallet = getSignerPublicKey(signerSecretKey, org, signer.fromAddress);
      appendAuditEvent(
        "payout_approved",
        `Payout ${amount} ${asset} to ${destination} (approved by ${session.email ?? session.id})`,
        session.id,
        {
          signerWallet,
          amount,
          asset,
          stellarTxHash: txHash,
          destination,
          recipientLabel,
        }
      );
    } catch (err) {
      failPayout(record.id);
      record.status = "failed";
      const msg = err instanceof Error ? err.message : "Stellar payment failed";
      console.error("[payouts] Stellar payout error:", err instanceof Error ? err.stack : String(err));
      return NextResponse.json(
        { error: `Payout failed: ${msg}`, payoutId: record.id },
        { status: 502 }
      );
    }
    appendAuditEvent("payout", `Payout to Stellar: ${destination}`, session.id);
    return NextResponse.json({ payout: record });
  }

  const bankAccountId = body.bankAccountId;
  const recipientLabel = body.recipientLabel;
  if (!bankAccountId) {
    return NextResponse.json(
      { error: "bankAccountId or toStellar destination required" },
      { status: 400 }
    );
  }

  const record = createPayout(session.id, amount, {
    type: "to_bank",
    bankAccountId,
    recipientLabel,
    orgId,
  });
  appendAuditEvent("payout", `Payout to bank: ${recipientLabel ?? bankAccountId}`, session.id);
  return NextResponse.json({ payout: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payout request failed";
    console.error("[payouts] POST error:", err instanceof Error ? err.stack : String(err));
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    );
  }
}
