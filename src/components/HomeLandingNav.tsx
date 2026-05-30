"use client";

import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const SOZU_CAPITAL_URL = "https://sozu.capital";

export function HomeLandingNav() {
  return (
    <header className="pointer-events-none relative z-20 flex items-center justify-end px-6 py-6 md:px-10 lg:px-12">
      <a
        href={SOZU_CAPITAL_URL}
        className="!pointer-events-auto absolute left-1/2 inline-flex -translate-x-1/2 items-center transition-opacity hover:opacity-90"
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
      <div className="!pointer-events-auto">
        <LanguageSwitcher variant="compact" />
      </div>
    </header>
  );
}
