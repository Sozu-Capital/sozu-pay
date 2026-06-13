import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listRecipients, createRecipient } from "@/lib/recipients";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const recipients = await listRecipients(session.id);
  return NextResponse.json({ recipients });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const bankAccountId = typeof body.bankAccountId === "string" ? body.bankAccountId.trim() : "";
  const stellarAddress = typeof body.stellarAddress === "string" ? body.stellarAddress.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : undefined;
  const bankHolder = typeof body.bankHolder === "string" ? body.bankHolder.trim() : undefined;
  const bankCountry = typeof body.bankCountry === "string" ? body.bankCountry.trim() : undefined;
  const bankCurrency = typeof body.bankCurrency === "string" ? body.bankCurrency.trim() : undefined;
  const bankAccountNumber = typeof body.bankAccountNumber === "string" ? body.bankAccountNumber.trim() : undefined;
  const bankRoutingCode = typeof body.bankRoutingCode === "string" ? body.bankRoutingCode.trim() : undefined;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!dateOfBirth) {
    return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.json(
      { error: "Date of birth must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const recipient = await createRecipient(
    session.id,
    name,
    bankAccountId,
    stellarAddress,
    phone,
    dateOfBirth,
    bankHolder,
    bankCountry,
    bankCurrency,
    bankAccountNumber,
    bankRoutingCode
  );
  return NextResponse.json({ recipient });
}
