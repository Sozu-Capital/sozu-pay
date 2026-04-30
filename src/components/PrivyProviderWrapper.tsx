"use client";

import { PrivyProvider } from "@privy-io/react-auth";

// Client needs NEXT_PUBLIC_ prefix (Next.js only exposes these to the browser).
// Use same value as PRIVY_APP_ID.
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function PrivyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // email (OTP), passkey, and Google OAuth (Gmail). Enable Google in Privy Dashboard > Login methods > OAuth.
        loginMethods: ["email", "passkey", "google"],
        appearance: {
          theme: "light",
          accentColor: "#111827",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
        passkeys: {
          // Keep passkey as login method even if user unenrolls from MFA
          shouldUnlinkOnUnenrollMfa: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
