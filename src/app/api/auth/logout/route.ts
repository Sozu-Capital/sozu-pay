import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSession, clearSession } from "@/lib/auth/session";
import { clearUnlockedKey } from "@/lib/auth/wallet-unlock";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session) clearUnlockedKey(session.id);
  await clearSession();
  const baseUrl = getAppBaseUrl(request);
  return NextResponse.redirect(`${baseUrl}/login`);
}
