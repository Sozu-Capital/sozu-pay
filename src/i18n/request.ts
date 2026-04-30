import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const LOCALE_COOKIE = "sozupay_locale";
const SUPPORTED_LOCALES = ["es", "en"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? "");
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: SupportedLocale = isSupportedLocale(cookieLocale) ? cookieLocale : "es";
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});

