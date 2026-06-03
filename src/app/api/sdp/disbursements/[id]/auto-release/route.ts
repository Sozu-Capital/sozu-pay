import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  actorLabelFromUser,
  clearHotlinkCommitted,
  getDisbursementMetaAsync,
  invitesSentAtFromAudit,
} from "@/lib/disbursements/store";
import { getUserBySessionId } from "@/lib/db/users";

/**
 * PATCH /api/sdp/disbursements/[id]/auto-release
 * Toggle auto pay (local hotlink flag). Enabling requires passkey via /commit.
 * Body: { enabled: false } to disable.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id: disbursementId } = await params;
  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled;

  if (enabled !== false) {
    return NextResponse.json(
      {
        error: "To enable auto pay, use the toggle in the dashboard (passkey required).",
        code: "USE_COMMIT",
      },
      { status: 400 }
    );
  }

  const meta = await getDisbursementMetaAsync(disbursementId);
  const invitesSentAt = meta?.invitesSentAt ?? invitesSentAtFromAudit(disbursementId);
  if (!invitesSentAt) {
    return NextResponse.json(
      { error: "Send invite emails before changing auto pay.", code: "INVITES_REQUIRED" },
      { status: 400 }
    );
  }

  if (!meta?.hotlinkAt) {
    return NextResponse.json({ ok: true, enabled: false, alreadyDisabled: true });
  }

  const user = await getUserBySessionId(session.id);
  const label = user ? actorLabelFromUser(user) : session.id;
  clearHotlinkCommitted(disbursementId, { userId: session.id, label });

  return NextResponse.json({ ok: true, enabled: false });
}
