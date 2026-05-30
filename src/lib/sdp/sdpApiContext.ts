import "server-only";

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  parseInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  type SdpInvitePayload,
} from "./invitePayload";

export type SdpApiContext =
  | {
      ok: true;
      invite: SdpInvitePayload;
      clientDomain: string;
      clientSigningSecret: string;
      stellarAccount: string;
      /** SDP-Tenant-Name header value — required for multi-tenant SDP */
      tenantName: string;
    }
  | { ok: false; status: number; error: string };

export async function getSdpApiContext(): Promise<SdpApiContext> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const raw = (await cookies()).get(SDP_INVITE_COOKIE_NAME)?.value;
  const invite = parseInviteCookie(raw);
  if (!invite) {
    return {
      ok: false,
      status: 400,
      error:
        "Missing or expired disbursement invitation. Open the link from your message again.",
    };
  }

  const clientDomain = process.env.WALLET_CLIENT_DOMAIN?.trim();
  if (!clientDomain) {
    return {
      ok: false,
      status: 503,
      error: "Server misconfiguration: WALLET_CLIENT_DOMAIN",
    };
  }

  const clientSigningSecret = process.env.SEP10_CLIENT_SIGNING_SECRET?.trim();
  if (!clientSigningSecret) {
    return {
      ok: false,
      status: 503,
      error: "Server misconfiguration: SEP10_CLIENT_SIGNING_SECRET",
    };
  }

  const user = await getUserBySessionId(session.id);
  const stellarAccount = user?.stellar_public_key?.trim();
  if (!stellarAccount) {
    return {
      ok: false,
      status: 400,
      error: "Register a Stellar wallet in Profile before continuing.",
    };
  }

  const tenantName =
    invite.tenantName?.trim() ||
    process.env.SDP_TENANT_NAME?.trim() ||
    "";

  return {
    ok: true,
    invite,
    clientDomain,
    clientSigningSecret,
    stellarAccount,
    tenantName,
  };
}

export { SDP_INVITE_COOKIE_NAME };
