import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { getSozuCreditSupabase } from "@/lib/sozucredit/supabase";

export type BeneficiaryHint = {
  fullName: string | null;
  sozuTag: string | null;
};

function profileFullName(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null;
  for (const key of ["full_name", "fullName", "display_name", "displayName"] as const) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function lookupSozuCreditProfileByEmail(email: string): Promise<{
  username: string | null;
  displayName: string | null;
}> {
  const creditSb = getSozuCreditSupabase();
  if (creditSb) {
    try {
      const creditUrl = (
        process.env.SOZUCREDIT_SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SOZUCREDIT_SUPABASE_URL ??
        ""
      ).replace(/\/$/, "");
      const creditKey = process.env.SOZUCREDIT_SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (creditUrl && creditKey) {
        const res = await fetch(
          `${creditUrl}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(`email.eq.${email}`)}`,
          {
            headers: {
              Authorization: `Bearer ${creditKey}`,
              apikey: creditKey,
            },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const json = (await res.json()) as { users?: Array<{ id?: string; email?: string }> };
          const user =
            json.users?.find((u) => u.email?.trim().toLowerCase() === email) ?? json.users?.[0];
          if (user?.id) {
            const { data: profile } = await creditSb
              .from("profiles")
              .select("username, display_name")
              .eq("id", user.id)
              .limit(1)
              .maybeSingle();
            const p = profile as { username?: string; display_name?: string } | null;
            return {
              username: p?.username?.trim().replace(/^\$+/, "") || null,
              displayName: p?.display_name?.trim() || null,
            };
          }
        }
      }
    } catch {
      // fall through to SozuPay DB
    }
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(
    /\/$/,
    ""
  );
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    return { username: null, displayName: null };
  }

  try {
    const res = await fetch(
      `${baseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(`email.eq.${email}`)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return { username: null, displayName: null };

    const json = (await res.json()) as { users?: Array<{ id?: string; email?: string }> };
    const user =
      json.users?.find((u) => u.email?.trim().toLowerCase() === email) ?? json.users?.[0];
    if (!user?.id) return { username: null, displayName: null };

    const sb = getSupabase();
    const { data: profile } = await sb
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    const row = profile as { username?: string; display_name?: string } | null;
    return {
      username: row?.username?.trim().replace(/^\$+/, "") || null,
      displayName: row?.display_name?.trim() || null,
    };
  } catch {
    return { username: null, displayName: null };
  }
}

/** Batch lookup: beneficiary email → full name + Sozu tag from SozuCredit profiles / credit apps. */
export async function resolveBeneficiaryHintsByEmails(
  emails: string[]
): Promise<Map<string, BeneficiaryHint>> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const out = new Map<string, BeneficiaryHint>();

  if (unique.length === 0) return out;

  const sb = getSupabase();

  await Promise.all(
    unique.map(async (email) => {
      const hint: BeneficiaryHint = { fullName: null, sozuTag: null };

      const creditProfile = await lookupSozuCreditProfileByEmail(email);
      if (creditProfile.username) hint.sozuTag = creditProfile.username;
      if (creditProfile.displayName) hint.fullName = creditProfile.displayName;

      if (!hint.fullName || !hint.sozuTag) {
        const { data: userRow } = await sb
          .from("users")
          .select("id, username")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        const user = userRow as { id?: number; username?: string | null } | null;
        const tag = user?.username?.trim().replace(/^\$+/, "");
        if (tag && !hint.sozuTag) hint.sozuTag = tag;

        if (!hint.fullName && user?.id != null) {
          const { data: apps } = await sb
            .from("credit_applications")
            .select("applicant_profile")
            .eq("applicant_user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1);

          const applicantProfile = (
            apps?.[0] as { applicant_profile?: Record<string, unknown> } | undefined
          )?.applicant_profile;
          const fullName = profileFullName(applicantProfile);
          if (fullName) hint.fullName = fullName;
        }
      }

      out.set(email, hint);
    })
  );

  return out;
}
