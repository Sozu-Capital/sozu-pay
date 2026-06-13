import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <OnboardingShell>{children}</OnboardingShell>
    </NextIntlClientProvider>
  );
}
