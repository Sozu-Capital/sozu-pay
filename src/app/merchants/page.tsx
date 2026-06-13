import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MerchantsPageContent } from "@/components/MerchantsPageContent";

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; fresh?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (session && params.fresh !== "1") {
    const returnTo = params.returnTo;
    if (returnTo && returnTo.startsWith("/")) {
      redirect(returnTo);
    }
    redirect("/onboarding/organizations");
  }

  return (
    <MerchantsPageContent
      clearSessionOnMount={params.fresh === "1"}
      returnTo={params.returnTo}
    />
  );
}
