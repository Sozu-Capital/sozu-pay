import { DashboardNav } from "@/components/DashboardNav";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { DashboardProfileProvider } from "@/contexts/DashboardProfileContext";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { getTranslations } from "next-intl/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("dashboardLayout");

  return (
    <DarkGradientBg>
      <DashboardProfileProvider>
        <OnboardingRedirect />
        <div className="dark flex min-h-screen flex-col md:flex-row">
        <aside
          className="w-full md:w-56 border-b md:border-b-0 md:border-r border-white/10 bg-black/40 backdrop-blur-sm p-4 flex flex-col min-h-0"
          aria-label={t("navAria")}
        >
          <h2 className="font-semibold text-lg text-white shrink-0">SozuPay</h2>
          <DashboardNav />
        </aside>
        <main className="flex-1 p-4 md:p-8" role="main">
          {children}
        </main>
      </div>
      </DashboardProfileProvider>
    </DarkGradientBg>
  );
}
