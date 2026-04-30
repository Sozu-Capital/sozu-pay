import { CreditPortalShell } from "@/components/CreditPortalShell";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";

export default function CreditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <CreditPortalShell>{children}</CreditPortalShell>
      </div>
    </NextIntlClientProvider>
  );
}
