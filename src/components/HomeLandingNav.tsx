"use client";

import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const SOZU_CAPITAL_URL = "https://sozu.capital";

export function HomeLandingNav() {
  return (
    <header className="pointer-events-none relative z-30 flex min-h-[var(--home-landing-nav-height,4.75rem)] items-center justify-end px-6 py-6 md:min-h-0 md:px-10 lg:px-12">
      {/* Block Spline iframe from capturing taps across the nav band (iOS passes through otherwise). */}
      <div
        className="pointer-events-auto absolute inset-0 z-0"
        aria-hidden
      />
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
      <div className="relative z-10 !pointer-events-auto [&_button]:pointer-events-auto">
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
