import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { parseAvatarDataUrl } from "@/lib/avatar";
import { getSupabase } from "@/lib/supabase/server";

/**
 * POST /api/profile/avatar
 * Body: { image: data-url | null } — the signed-in person's portrait.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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
    .from("users")
    .update({ avatar_url: image, updated_at: new Date().toISOString() })
    .eq("id", user.id);

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
