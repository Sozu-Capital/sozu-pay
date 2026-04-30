import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth/session";
import { getOrCreateUserByPrivy } from "@/lib/db/users";

/**
 * Dev/demo: create session from any email without Privy (credit portal only).
 * Disabled in production unless CREDIT_MOCK_AUTH=true.
 */
export async function POST(req: Request) {
  const allowed =
    process.env.NODE_ENV !== "production" ||
    process.env.CREDIT_MOCK_AUTH === "true";
  if (!allowed) {
    return NextResponse.json(
      { error: "Mock auth is disabled in this environment." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return NextResponse.json({ error: "Ingresá un correo válido." }, { status: 400 });
  }

  const mockPrivyId = `mock_credit_${Buffer.from(raw).toString("base64url").slice(0, 64)}`;

  try {
    await getOrCreateUserByPrivy(mockPrivyId, raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo crear la cuenta.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    await setSession({
      id: mockPrivyId,
      email: raw,
      twoFactorEnabled: false,
      orgId: null,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: raw });
}
