import { LoginPageContent } from "@/components/LoginPageContent";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sdpInvite?: string; returnTo?: string }>;
}) {
  const sp = await searchParams;
  const returnTo = typeof sp.returnTo === "string" ? sp.returnTo : undefined;
  return (
    <LoginPageContent
      clearSessionOnMount={sp.sdpInvite !== "1" && !returnTo}
      returnTo={returnTo}
    />
  );
}
