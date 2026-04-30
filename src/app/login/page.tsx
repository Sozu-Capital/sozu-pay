import { LoginPageContent } from "@/components/LoginPageContent";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sdpInvite?: string }>;
}) {
  const sp = await searchParams;
  return <LoginPageContent clearSessionOnMount={sp.sdpInvite !== "1"} />;
}
