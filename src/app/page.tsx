import { LoginPageContent } from "@/components/LoginPageContent";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sdpInvite?: string; returnTo?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const returnTo = typeof sp.returnTo === "string" ? sp.returnTo : undefined;
  /** After logout (`?fresh=1`), clear session on home. Default home keeps existing session. */
  const clearSessionOnMount = sp.fresh === "1";

  return (
    <LoginPageContent
      clearSessionOnMount={clearSessionOnMount}
      returnTo={returnTo}
    />
  );
}
