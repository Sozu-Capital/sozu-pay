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
import {
  recipientsToCSV,
  receiversToRecipientRows,
  type RecipientRow,
} from "@/lib/disbursements/csv";
import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";
import {
  externalIdAsBeneficiaryName,
  receiverVerificationDob,
} from "@/lib/sdp/receiverDisplay";
import { getUserBySessionId } from "@/lib/db/users";

const EDITABLE = new Set(["DRAFT", "READY"]);

type PatchBody = {
  email?: string;
  legalName?: string;
  dateOfBirth?: string;
};

/**
 * PATCH /api/sdp/disbursements/[id]/beneficiary
 * Update one beneficiary's legal name and/or DOB while batch is DRAFT/READY.
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
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (body?.legalName === undefined && body?.dateOfBirth === undefined) {
    return NextResponse.json(
      { error: "legalName or dateOfBirth is required" },
      { status: 400 }
    );
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
        { error: "Beneficiaries can only be edited before payments start (DRAFT or READY)." },
        { status: 400 }
      );
    }

    const receivers = await listReceivers(id);
    const target = receivers.find((r) => r.email?.trim().toLowerCase() === email);
    if (!target) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const oldLegalName =
      externalIdAsBeneficiaryName(target.external_id ?? "") ?? "";
    const oldDob = receiverVerificationDob(target);

    const recipients = receiversToRecipientRows(receivers);
    const rowIndex = recipients.findIndex((r) => r.email.toLowerCase() === email);
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const updated: RecipientRow = { ...recipients[rowIndex] };

    if (body.legalName !== undefined) {
      const nextName = body.legalName.trim();
      if (!nextName) {
        return NextResponse.json(
          { error: "Full legal name cannot be empty" },
          { status: 400 }
        );
      }
      updated.name = nextName;
    }

    if (body.dateOfBirth !== undefined) {
      const nextDob = normalizeVerificationForSdp(body.dateOfBirth.trim());
      if (body.dateOfBirth.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(nextDob)) {
        return NextResponse.json(
          { error: "Date of birth must be YYYY-MM-DD (e.g. 1997-08-05)" },
          { status: 400 }
        );
      }
      updated.verification = nextDob;
    }

    recipients[rowIndex] = updated;
    const csv = recipientsToCSV(recipients);
    await uploadInstructions(id, Buffer.from(csv, "utf-8"));

    ensureDisbursementMeta(id);

    const newLegalName = updated.name.trim();
    const newDob = updated.verification?.trim() ?? "";

    if (body.legalName !== undefined && newLegalName !== oldLegalName) {
      appendDisbursementAudit(id, {
        action: "recipient_name_updated",
        actorUserId: actor.userId,
        actorLabel: actor.label,
        message: `Updated legal name for ${email}: "${oldLegalName || "—"}" → "${newLegalName}"`,
        metadata: {
          email,
          field: "legal_name",
          oldValue: oldLegalName,
          newValue: newLegalName,
        },
      });
    }

    if (body.dateOfBirth !== undefined && newDob !== oldDob) {
      appendDisbursementAudit(id, {
        action: "recipient_dob_updated",
        actorUserId: actor.userId,
        actorLabel: actor.label,
        message: `Updated date of birth for ${email}: "${oldDob || "—"}" → "${newDob || "—"}"`,
        metadata: {
          email,
          field: "date_of_birth",
          oldValue: oldDob,
          newValue: newDob,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/beneficiary PATCH]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
