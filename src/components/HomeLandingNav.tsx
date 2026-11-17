"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useHomeAuthUiOptional } from "@/components/HomeAuthUiContext";
import { cn } from "@/lib/utils";

const navActionClass =
  "inline-flex min-h-[28px] items-center justify-center rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

export function HomeLandingNav() {
  const t = useTranslations("login");
  const authUi = useHomeAuthUiOptional();

  return (
    <header className="pointer-events-none relative z-30 flex min-h-[var(--home-landing-nav-height,4.75rem)] items-center justify-end px-6 py-6 md:min-h-0 md:px-10 lg:px-12">
      <div className="relative z-10 ml-auto flex items-center gap-2 !pointer-events-auto [&_button]:pointer-events-auto">
        {authUi ? (
          <button
            type="button"
            onClick={() =>
              authUi.registerOpen ? authUi.closeRegister() : authUi.openRegister()
            }
            className={cn(
              navActionClass,
              authUi.registerOpen && "border-white/45 bg-white/20 text-white"
            )}
            aria-pressed={authUi.registerOpen}
          >
            {t("passkeyCreateAccount")}
          </button>
        ) : null}
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
