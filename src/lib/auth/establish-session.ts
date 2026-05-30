import { setSession, type SessionUser } from "@/lib/auth/session";
import type { User } from "@/lib/db/users";

export function sessionUserFromDbUser(user: User): SessionUser {
  return {
    id: String(user.id),
    email: user.email,
    username: user.username ?? undefined,
    twoFactorEnabled: false,
    orgId: user.org_id,
  };
}

export async function establishSessionForUser(user: User): Promise<SessionUser> {
  const sessionUser = sessionUserFromDbUser(user);
  await setSession(sessionUser);
  return sessionUser;
}
