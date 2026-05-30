import { getSession, type SessionUser } from "@/lib/auth/session";
import { getUserBySessionId, type User } from "@/lib/db/users";

export async function getSessionUser(): Promise<{
  session: SessionUser;
  user: User;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await getUserBySessionId(session.id);
  if (!user) return null;
  return { session, user };
}

export function isOrgStaff(user: User): boolean {
  return (
    !!user.org_id &&
    (user.admin_level === "admin" || user.admin_level === "super_admin")
  );
}

export function staffOrgId(user: User): string | null {
  return user.org_id;
}
