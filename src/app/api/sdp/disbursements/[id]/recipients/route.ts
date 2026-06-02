import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  getDisbursement,
  listReceivers,
  uploadInstructions,
} from "@/lib/sdp/adminClient";
import {
  actorLabelFromUser,
  appendDisbursementAudit,
  ensureDisbursementMeta,
} from "@/lib/disbursements/store";
import { recipientsToCSV, type RecipientRow } from "@/lib/disbursements/csv";
import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";
import { getUserBySessionId } from "@/lib/db/users";

const EDITABLE = new Set(["DRAFT", "READY"]);

function parseRecipients(body: unknown): RecipientRow[] | null {
  if (!body || typeof body !== "object") return null;
  const recipients = (body as { recipients?: unknown }).recipients;
  if (!Array.isArray(recipients)) return null;
  const rows: RecipientRow[] = [];
  for (const r of recipients) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const email = String(row.email ?? "").trim();
    if (!name || !email) continue;
    rows.push({
      name,
      email,
      phone: String(row.phone ?? "").trim(),
      amount: String(row.amount ?? "").trim(),
      verification: normalizeVerificationForSdp(String(row.verification ?? "")),
    });
  }
  return rows.length > 0 ? rows : null;
}

/**
 * PATCH /api/sdp/disbursements/[id]/recipients
 * Body: { recipients: RecipientRow[] } — replaces payment instructions while batch is DRAFT/READY.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const recipients = parseRecipients(await request.json().catch(() => null));
  if (!recipients) {
    return NextResponse.json({ error: "recipients array is required" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  const actor = {
    userId: session.id,
    label: user ? actorLabelFromUser(user) : session.id,
  };

  try {
    const disbursement = await getDisbursement(id);
    if (!EDITABLE.has(disbursement.status)) {
      return NextResponse.json(
        { error: "Recipients can only be edited before payments start (DRAFT or READY)." },
        { status: 400 }
      );
    }

    const previous = await listReceivers(id);
    const prevEmails = new Set(
      previous.map((r) => r.email?.trim().toLowerCase()).filter(Boolean) as string[]
    );
    const nextEmails = new Set(recipients.map((r) => r.email.toLowerCase()));

    const csv = recipientsToCSV(recipients);
    await uploadInstructions(id, Buffer.from(csv, "utf-8"));

    ensureDisbursementMeta(id);
    for (const email of nextEmails) {
      if (!prevEmails.has(email)) {
        const row = recipients.find((r) => r.email.toLowerCase() === email)!;
        appendDisbursementAudit(id, {
          action: "recipient_added",
          actorUserId: actor.userId,
          actorLabel: actor.label,
          message: `Added ${row.name} (${row.email})`,
          metadata: { email: row.email },
        });
      }
    }
    for (const email of prevEmails) {
      if (!nextEmails.has(email)) {
        appendDisbursementAudit(id, {
          action: "recipient_removed",
          actorUserId: actor.userId,
          actorLabel: actor.label,
          message: `Removed recipient ${email}`,
          metadata: { email },
        });
      }
    }
    if (prevEmails.size !== nextEmails.size || [...prevEmails].some((e) => !nextEmails.has(e))) {
      appendDisbursementAudit(id, {
        action: "recipients_updated",
        actorUserId: actor.userId,
        actorLabel: actor.label,
        message: `Recipient list updated (${recipients.length} total)`,
        metadata: { count: String(recipients.length) },
      });
    }

    return NextResponse.json({ ok: true, count: recipients.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/recipients PATCH]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
