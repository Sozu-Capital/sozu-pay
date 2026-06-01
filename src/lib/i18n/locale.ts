export const LOCALE_COOKIE = "sozupay_locale";
export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "es";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? "");
}

/** Read locale from document.cookie (client only). */
export function readClientLocaleCookie(): SupportedLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  const value = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/** Set locale cookie immediately in the browser (before server round-trip). */
/** Read locale from Next.js cookies() (server components / route handlers). */
export function readServerLocaleCookie(
  cookieValue: string | undefined | null
): SupportedLocale {
  return isSupportedLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}

export function writeClientLocaleCookie(locale: SupportedLocale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:";
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${
    secure ? "; secure" : ""
  }`;
}
