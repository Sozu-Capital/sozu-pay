"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const navActionClass =
  "inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

export type MerchantsLandingStep = "hero" | "beta" | "auth";

type MerchantsLandingNavProps = {
  step: MerchantsLandingStep;
  onCreateAccountFromHero: () => void;
};

export function MerchantsLandingNav({ step, onCreateAccountFromHero }: MerchantsLandingNavProps) {
  const t = useTranslations("login");

  const showCreateAccount = step === "hero";

  return (
    <header className="pointer-events-none relative z-30 flex min-h-[var(--home-landing-nav-height,4.75rem)] items-center justify-end px-6 py-6 md:min-h-0 md:px-10 lg:px-12">
      <div className="relative z-10 ml-auto flex items-center gap-2 !pointer-events-auto [&_button]:pointer-events-auto">
        {showCreateAccount ? (
          <button
            type="button"
            onClick={onCreateAccountFromHero}
            className={navActionClass}
          >
            {t("passkeyCreateAccount")}
          </button>
        ) : null}
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
