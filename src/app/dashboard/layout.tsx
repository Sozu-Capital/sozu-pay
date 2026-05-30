import { DashboardShell } from "@/components/DashboardShell";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { DashboardProfileProvider } from "@/contexts/DashboardProfileContext";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DarkGradientBg>
      <DashboardProfileProvider>
        <OnboardingRedirect />
        <DashboardShell>{children}</DashboardShell>
      </DashboardProfileProvider>
    </DarkGradientBg>
  );
}
