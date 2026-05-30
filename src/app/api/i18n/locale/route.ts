import { NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  type SupportedLocale,
} from "@/lib/i18n/locale";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const locale: SupportedLocale = isSupportedLocale(body?.locale) ? body.locale : DEFAULT_LOCALE;

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

