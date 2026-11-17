import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { resolveCanonicalActiveOrgId } from "@/lib/db/org-members";
import { parseAvatarDataUrl } from "@/lib/avatar";
import { getSupabase } from "@/lib/supabase/server";

/**
 * POST /api/profile/org/avatar
 * Body: { image: data-url | null } — portrait for the active business account.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const orgId = await resolveCanonicalActiveOrgId({
    userId: user.id,
    primaryOrgId: user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: user.stellar_public_key,
  });
  if (!orgId) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  let image: string | null;
  try {
    const body = await request.json().catch(() => ({}));
    image = parseAvatarDataUrl(body.image);
  } catch (err) {
    const code = err instanceof Error ? err.message : "INVALID_AVATAR";
    return NextResponse.json(
      { error: code === "AVATAR_TOO_LARGE" ? "Image is too large." : "Choose a JPG, PNG, or WebP image.", code },
      { status: 400 },
    );
  }

  const { error } = await getSupabase()
    .from("organizations")
    .update({ avatar_url: image, updated_at: new Date().toISOString() })
    .eq("id", orgId);

  if (error) {
    const missing = /avatar_url/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "Profile photos are not set up on this database yet."
          : "Could not save photo.",
        code: missing ? "AVATAR_COLUMN_MISSING" : "AVATAR_SAVE_FAILED",
      },
      { status: missing ? 503 : 500 },
    );
  }

  return NextResponse.json({ avatar_url: image });
}
