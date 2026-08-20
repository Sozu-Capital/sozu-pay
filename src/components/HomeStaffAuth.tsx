"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HomePollarAuth } from "@/components/HomePollarAuth";
import { HomePasskeyAuth } from "@/components/HomePasskeyAuth";
import { HomeAuthUiProvider } from "@/components/HomeAuthUiContext";

type HomeStaffAuthProps = {
  returnTo?: string;
};

/**
 * Staff door: Google is the primary CTA. Passkey and PIN stay on the same screen
 * as quieter options — never a phone-QR WebAuthn sheet.
 */
export function HomeStaffAuth({ returnTo }: HomeStaffAuthProps) {
  const t = useTranslations("login");
  const [method, setMethod] = useState<"google" | "passkey" | "pin">("google");

  return (
    <HomeAuthUiProvider>
      <div className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-4">
        {method === "google" ? <HomePollarAuth returnTo={returnTo} /> : null}
        {method === "passkey" || method === "pin" ? (
          <HomePasskeyAuth returnTo={returnTo} forcePin={method === "pin"} />
        ) : null}

        <div className="flex flex-col gap-2">
          {method !== "google" ? (
            <button
              type="button"
              onClick={() => setMethod("google")}
              className="text-center text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              {t("continueWithGoogle")}
            </button>
          ) : null}
          {method !== "passkey" ? (
            <button
              type="button"
              onClick={() => setMethod("passkey")}
              className="text-center text-sm text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
            >
              {t("passkeySignInCta")}
            </button>
          ) : null}
          {method !== "pin" ? (
            <button
              type="button"
              onClick={() => setMethod("pin")}
              className="text-center text-sm text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
            >
              {t("passkeyUsePin")}
            </button>
          ) : null}
        </div>
      </div>
    </HomeAuthUiProvider>
  );
}
