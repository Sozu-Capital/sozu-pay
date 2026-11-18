import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, updateUserStellarPublicKey } from "@/lib/db/users";
import { getOrganizationForUser, updateOrganizationReceiveAddress } from "@/lib/db/organizations";
import { readOrgPasskeyExport, saveOrgPasskeyExport } from "@/lib/db/org-passkey-export";
import { createSealedReceiveAccount, receiveAccountStatus } from "@/lib/stellar/provision-receive-account";

function prfFromBody(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const binary = atob(value.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.byteLength >= 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function authorizedOrg() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return { error: NextResponse.json({ error: "No organization." }, { status: 400 }) };
  }
  if (user.admin_level !== "super_admin" && user.admin_level !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  const org = await getOrganizationForUser(user.org_id);
  if (!org) return { error: NextResponse.json({ error: "Organization not found." }, { status: 404 }) };
  return { session, user, org };
}

/** GET the passkey-sealed export blob. The secret is not in this response. */
export async function GET() {
  const auth = await authorizedOrg();
  if ("error" in auth && auth.error) return auth.error;
  if (!("org" in auth)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const blob = await readOrgPasskeyExport(auth.org.id);
    if (!blob) {
      return NextResponse.json({ error: "No passkey export is saved for this store." }, { status: 404 });
    }
    return NextResponse.json({
      publicKey: auth.org.stellar_disbursement_public_key,
      blob,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the export.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/profile/org/receive-account
 * Body: { prf: base64 } from the store passkey.
 * Funds a new classic account, opens the USDC trustline, and stores only the sealed blob.
 */
export async function POST(request: Request) {
  const auth = await authorizedOrg();
  if ("error" in auth && auth.error) return auth.error;
  if (!("org" in auth) || !("user" in auth) || !("session" in auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { prf?: unknown };
  const prf = prfFromBody(body.prf);
  if (!prf) {
    return NextResponse.json({ error: "Passkey confirmation is required." }, { status: 400 });
  }

  try {
    const status = await receiveAccountStatus(auth.org.stellar_disbursement_public_key);
    if (status === "ready" && auth.org.stellar_disbursement_public_key) {
      return NextResponse.json({
        ok: true,
        alreadyReady: true,
        publicKey: auth.org.stellar_disbursement_public_key,
      });
    }

    const created = await createSealedReceiveAccount(prf);
    const updated = await updateOrganizationReceiveAddress(auth.org.id, created.publicKey);
    if (!updated) {
      return NextResponse.json({ error: "Account is funded, but the store address was not saved." }, { status: 500 });
    }
    await saveOrgPasskeyExport(auth.org.id, created.blob);
    await updateUserStellarPublicKey(auth.session.id, created.publicKey);
    return NextResponse.json({ ok: true, alreadyReady: false, publicKey: created.publicKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the receiving account.";
    console.error("[receive-account]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
