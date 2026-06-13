"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useHomeAuthUiOptional } from "@/components/HomeAuthUiContext";
import { cn } from "@/lib/utils";

const SOZU_CAPITAL_URL = "https://sozu.capital";

const navActionClass =
  "inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

export type MerchantsLandingStep = "hero" | "beta" | "auth";

type MerchantsLandingNavProps = {
  step: MerchantsLandingStep;
  onCreateAccountFromHero: () => void;
};

export function MerchantsLandingNav({ step, onCreateAccountFromHero }: MerchantsLandingNavProps) {
  const t = useTranslations("login");
  const authUi = useHomeAuthUiOptional();

  function handleCreateAccount() {
    if (step === "hero") {
      onCreateAccountFromHero();
      return;
    }
    if (!authUi) return;
    if (authUi.registerOpen) authUi.closeRegister();
    else authUi.openRegister();
  }

  const showCreateAccount = step === "hero" || step === "auth";

  return (
    <header className="pointer-events-none relative z-30 flex min-h-[var(--home-landing-nav-height,4.75rem)] items-center justify-end px-6 py-6 md:min-h-0 md:px-10 lg:px-12">
      <a
        href={SOZU_CAPITAL_URL}
        className="relative z-10 !pointer-events-auto absolute left-1/2 inline-flex -translate-x-1/2 items-center transition-opacity hover:opacity-90"
        aria-label="sozu.capital"
        rel="noopener noreferrer"
      >
        <Image
          src="/sozucapital_logo_tb.png"
          alt=""
          width={32}
          height={32}
          className="h-7 w-7 shrink-0 object-contain brightness-0 invert"
          priority
        />
      </a>
      <div className="relative z-10 ml-auto flex items-center gap-2 !pointer-events-auto [&_button]:pointer-events-auto">
        {showCreateAccount && authUi ? (
          <button
            type="button"
            onClick={handleCreateAccount}
            className={cn(
              navActionClass,
              step === "auth" && authUi.registerOpen && "border-white/45 bg-white/20 text-white"
            )}
            aria-pressed={step === "auth" ? authUi.registerOpen : undefined}
          >
            {t("passkeyCreateAccount")}
          </button>
        ) : null}
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
