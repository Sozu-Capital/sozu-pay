"use client";

import type { CSSProperties } from "react";

const LOGO_MASK: CSSProperties = {
  WebkitMaskImage: "url(/sozucapital_logo_tb.png)",
  maskImage: "url(/sozucapital_logo_tb.png)",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

/** Shown only when the Spline embed fails or times out — not used during normal load. */
export function HomePageHero() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] flex min-h-full items-center justify-center px-6"
      aria-hidden
    >
      <div className="relative h-52 w-52 mix-blend-soft-light sm:h-72 sm:w-72 md:h-[22rem] md:w-[22rem]">
        {/* Soft etched fill — visible behind Spline */}
        <div
          className="absolute inset-0"
          style={{
            ...LOGO_MASK,
            background:
              "linear-gradient(155deg, rgba(255, 252, 245, 0.38) 0%, rgba(255, 252, 245, 0.18) 45%, rgba(255, 252, 245, 0.28) 100%)",
          }}
        />
        {/* Top-left edge catch — shallow carve highlight */}
        <div
          className="absolute inset-0 -translate-x-px -translate-y-px opacity-60"
          style={{
            ...LOGO_MASK,
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 30%, transparent 55%)",
          }}
        />
        {/* Bottom-right edge — very subtle depth, keeps it light */}
        <div
          className="absolute inset-0 translate-x-px translate-y-px opacity-35"
          style={{
            ...LOGO_MASK,
            background:
              "linear-gradient(315deg, transparent 50%, rgba(0, 0, 0, 0.18) 100%)",
          }}
        />
      </div>
    </div>
  );
}
