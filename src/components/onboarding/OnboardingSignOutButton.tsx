"use client";

import { useTranslations } from "next-intl";
import { useSignOut } from "@/lib/auth/useSignOut";

export function OnboardingSignOutButton() {
  const t = useTranslations("nav");
  const { signOut, signingOut } = useSignOut();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={signingOut}
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={t("logOut")}
    >
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
    </button>
  );
}
