import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";
import { fetchSep24Info } from "@/lib/sdp/sep24Server";

export async function GET() {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const jwt = await getSdpSep10JwtCookie();
  if (!jwt) {
    return NextResponse.json(
      { error: "SEP-10 session expired." },
      { status: 401 }
    );
  }

  const res = await fetchSep24Info(ctx.invite.sep24Base, jwt);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  return NextResponse.json({ info: res.info.raw });
}
