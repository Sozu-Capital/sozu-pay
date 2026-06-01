import { DashboardShell } from "@/components/DashboardShell";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { DashboardProfileProvider } from "@/contexts/DashboardProfileContext";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { getDashboardBootstrapData } from "@/lib/dashboard/server-bootstrap";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch all dashboard data server-side so the client hydrates with data
  // already present — balance appears on first paint, no loading flash.
  const initialData = await getDashboardBootstrapData().catch(() => null);

  return (
    <DarkGradientBg>
      <DashboardProfileProvider initialData={initialData}>
        <OnboardingRedirect />
        <DashboardShell>{children}</DashboardShell>
      </DashboardProfileProvider>
    </DarkGradientBg>
  );
}
