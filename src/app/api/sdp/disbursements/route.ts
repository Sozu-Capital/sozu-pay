import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createDisbursement,
  listDisbursements,
  uploadInstructions,
  listWallets,
  listAssets,
} from "@/lib/sdp/adminClient";

function notConfigured() {
  return NextResponse.json(
    { error: "SDP_API_URL, SDP_ADMIN_EMAIL, or SDP_ADMIN_PASSWORD not configured" },
    { status: 503 }
  );
}

function isSdpConfigured() {
  return !!(process.env.SDP_API_URL && process.env.SDP_ADMIN_EMAIL && process.env.SDP_ADMIN_PASSWORD);
}

/** GET /api/sdp/disbursements — list all disbursements */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSdpConfigured()) return notConfigured();

  try {
    const [disbursements, wallets, assets] = await Promise.all([
      listDisbursements(),
      listWallets(),
      listAssets(),
    ]);
    return NextResponse.json({ disbursements, wallets, assets });
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

    const disbursement = await createDisbursement({
      name,
      walletId,
      assetId: asset.id,
      registrationContactType: "EMAIL",
    });

    const csvBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file instanceof File ? file.name : "disbursement.csv";
    await uploadInstructions(disbursement.id, csvBuffer, fileName);

    return NextResponse.json({ disbursement }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements POST]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
