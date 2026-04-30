"use client";

import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";

/**
 * Stellar (XLM) wallet account created for each Turnkey sub-org.
 * See docs/04-integrations/turnkey-stellar-wallet-analysis.md and Turnkey docs:
 * https://docs.turnkey.com/concepts/wallets (ADDRESS_FORMAT_XLM, CURVE_ED25519)
 */
const STELLAR_WALLET_ACCOUNTS = [
  {
    curve: "CURVE_ED25519" as const,
    pathFormat: "PATH_FORMAT_BIP32" as const,
    path: "m/44'/148'/0'/0'/0",
    addressFormat: "ADDRESS_FORMAT_XLM" as const,
  },
];

const orgId = process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID ?? process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "";
const authProxyConfigId = process.env.NEXT_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID ?? process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID ?? "";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const oauthRedirectUri = process.env.NEXT_PUBLIC_TURNKEY_OAUTH_REDIRECT_URI ?? (typeof window !== "undefined" ? window.location.origin : "");
if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && googleClientId) {
  console.info("[Turnkey] Google OAuth redirect_uri sent to Turnkey:", oauthRedirectUri || "(none – Turnkey will use default, e.g. https://oauth-redirect.turnkey.com)");
}

export function TurnkeyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!orgId) {
    return <>{children}</>;
  }
  if (!authProxyConfigId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-gray-950 text-white">
        <h1 className="text-lg font-semibold">Turnkey: Auth Proxy Config required</h1>
        <p className="text-sm text-gray-400 max-w-md text-center">
          Add <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID</code> to your env.
          Create an Auth Proxy Config in the Turnkey dashboard and paste its ID here.
        </p>
        <a
          href="https://docs.turnkey.com/getting-started/auth-proxy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline"
        >
          Turnkey Auth Proxy docs →
        </a>
      </div>
    );
  }

  const config: TurnkeyProviderConfig = {
    organizationId: orgId,
    authProxyConfigId,
    auth: {
      ...((googleClientId || oauthRedirectUri) && {
        oauthConfig: {
          openOauthInPage: true,
          ...(googleClientId && { googleClientId }),
          ...(oauthRedirectUri && { oauthRedirectUri }),
        },
      }),
      createSuborgParams: {
        passkeyAuth: {
          userName: "Passkey User",
          customWallet: {
            walletName: "Stellar Wallet",
            walletAccounts: STELLAR_WALLET_ACCOUNTS,
          },
        },
        emailOtpAuth: {
          userName: "Email User",
          customWallet: {
            walletName: "Stellar Wallet",
            walletAccounts: STELLAR_WALLET_ACCOUNTS,
          },
        },
      },
    },
  };

  return (
    <TurnkeyProvider
      config={config}
      callbacks={{
        onError: (error) => console.error("[Turnkey]", error),
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}
