import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";

export const dynamic = "force-dynamic";
import {
  listDisbursements,
  listWallets,
  listAssets,
  ensureSozuCreditWallet,
} from "@/lib/sdp/adminClient";
import { fetchDisbursementPaymentRows } from "@/lib/disbursements/paymentRows";
import {
  PublishBatchError,
  publishDisbursementBatchToSdp,
  verificationByEmailFromCsv,
} from "@/lib/disbursements/publishBatch";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";
import {
  actorLabelFromUser,
  appendDisbursementAudit,
  archiveCompletedIfNeededAsync,
  ensureDisbursementMeta,
  getAllDisbursementMetaAsync,
  repairDisbursementMetaOrgIds,
} from "@/lib/disbursements/store";
import {
  isDisbursementArchived,
  isActiveDisbursementCampaign,
  isDisbursementFullyPaid,
  overlayDisbursementStats,
} from "@/lib/disbursements/mergeDisbursementStats";
import {
  filterDisbursementsForOrg,
  filterMetaForOrg,
} from "@/lib/disbursements/org-scope";
import { getUserBySessionId } from "@/lib/db/users";
import { recordUploadedVerifications } from "@/lib/disbursements/store";

function notConfigured() {
  return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
}

/** GET /api/sdp/disbursements — list all disbursements */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  if (!isSdpConfigured()) return notConfigured();

  try {
    const [disbursements, assets] = await Promise.all([
      listDisbursements(),
      listAssets(),
    ]);

    // Ensure SozuCredit is registered as a wallet in SDP (idempotent).
    // This is required for SEP-10 client_domain validation to succeed.
    await ensureSozuCreditWallet(
      assets.map((a) => ({ code: a.code, issuer: a.issuer }))
    );

    const wallets = await listWallets();
    const orgId = auth.user.org_id!;
    let meta = await getAllDisbursementMetaAsync();
    meta = await repairDisbursementMetaOrgIds(meta, orgId);
    meta = filterMetaForOrg(meta, orgId);

    const orgDisbursements = filterDisbursementsForOrg(disbursements, meta, orgId);

    const enriched = await Promise.all(
      orgDisbursements.map(async (d) => {
        const paymentRows = await fetchDisbursementPaymentRows(d.id, d.status);
        const overlaid = overlayDisbursementStats(d, meta[d.id], { paymentRows });
        return { d, paymentRows, overlaid };
      })
    );

    for (const { overlaid } of enriched) {
      if (
        isDisbursementFullyPaid(overlaid, meta[overlaid.id]) &&
        !isDisbursementArchived(meta[overlaid.id])
      ) {
        await archiveCompletedIfNeededAsync({ disbursement: overlaid });
      }
    }
    meta = filterMetaForOrg(await getAllDisbursementMetaAsync(), orgId);

    const activeDisbursements = enriched
      .filter(({ overlaid, paymentRows }) =>
        isActiveDisbursementCampaign(overlaid, meta[overlaid.id], { paymentRows })
      )
      .map(({ overlaid }) => overlaid);

    return NextResponse.json({
      disbursements: activeDisbursements,
      wallets,
      assets,
      meta,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * POST /api/sdp/disbursements — create a batch and upload CSV instructions.
 *
 * Accepts multipart/form-data:
 *   name        (string, required)
 *   walletId    (string, required) — SDP wallet UUID
 *   assetCode   (string, default "USDC") — used to look up the SDP asset UUID
 *   file        (CSV, required)
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  if (!isSdpConfigured()) return notConfigured();

  try {
    const form = await request.formData();
    const name = form.get("name");
    const walletId = form.get("walletId");
    const file = form.get("file");

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!walletId || typeof walletId !== "string") {
      return NextResponse.json({ error: "walletId is required" }, { status: 400 });
    }
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    // Resolve the SDP asset UUID — SDP v6 requires asset_id, not code+issuer.
    const assetCode = (form.get("assetCode") as string | null) ?? "USDC";
    const assets = await listAssets();
    const asset =
      assets.find((a) => a.code === assetCode) ?? assets[0];

    if (!asset) {
      const available = assets.map((a) => a.code).join(", ") || "none";
      return NextResponse.json(
        { error: `No asset with code "${assetCode}" found in SDP (available: ${available}). Register it in the SDP admin UI first.` },
        { status: 400 }
      );
    }

    const fileName = file instanceof File ? file.name : "disbursement.csv";
    const csvBuffer = Buffer.from(await file.arrayBuffer());

    let published;
    try {
      published = await publishDisbursementBatchToSdp({
        name,
        walletId,
        assetId: asset.id,
        csvBuffer,
        fileName,
      });
    } catch (e) {
      if (e instanceof PublishBatchError) {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: e.status }
        );
      }
      throw e;
    }

    const { disbursement, normalizedCsv } = published;
    const user = await getUserBySessionId(session.id);
    const label = user ? actorLabelFromUser(user) : session.id;
    ensureDisbursementMeta(disbursement.id, {
      createdByUserId: session.id,
      createdByLabel: label,
      orgId: auth.user.org_id!,
    });
    recordUploadedVerifications(
      disbursement.id,
      verificationByEmailFromCsv(normalizedCsv)
    );
    const uploadedByEmail = verificationByEmailFromCsv(normalizedCsv);
    appendDisbursementAudit(disbursement.id, {
      action: "created",
      actorUserId: session.id,
      actorLabel: label,
      message: `Batch "${name}" published with ${disbursement.total_payments} recipient(s)`,
      metadata: {
        totalPayments: String(disbursement.total_payments),
        uploadedVerifications: JSON.stringify(uploadedByEmail),
      },
    });

    return NextResponse.json({ disbursement }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements POST]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
