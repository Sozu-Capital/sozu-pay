import { NextResponse } from "next/server";

const LOCALE_COOKIE = "sozupay_locale";
const SUPPORTED_LOCALES = ["es", "en"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const locale = isSupportedLocale(body?.locale) ? body.locale : "es";

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set({
    name: LOCALE_COOKIE,
    value: locale,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return res;
}

