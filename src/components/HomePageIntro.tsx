"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useHomeLandingTransition } from "@/components/HomeLandingTransition";

type HomePageIntroProps = {
  cta?: ReactNode;
  status?: ReactNode;
  namespace?: string;
};

export function HomePageIntro({ cta, status, namespace = "login" }: HomePageIntroProps) {
  const t = useTranslations(namespace);
  const { contentVisible } = useHomeLandingTransition();

  const fadeClass = cn(
    "home-landing-fade",
    contentVisible ? "home-landing-fade-in" : "home-landing-fade-out"
  );

  return (
    <div className="pointer-events-none relative z-20 max-w-xl lg:max-w-2xl [&_*]:pointer-events-none">
      <div className={fadeClass}>
        <h1 className="font-manrope text-3xl font-light uppercase leading-[1.15] tracking-[0.14em] text-white sm:text-4xl lg:text-[2.75rem]">
          {t("homeHeadline")}
        </h1>
        <div className="mt-6 space-y-1 font-manrope">
          <p className="text-sm font-light leading-relaxed tracking-wide text-gray-300/95 sm:text-base">
            {t("homeSubheaderLead")}
          </p>
          <p className="text-sm font-light leading-relaxed tracking-wide text-gray-500 sm:text-[15px]">
            {t("homeSubheaderDetail")}
          </p>
        </div>
      </div>
      {cta ? (
        <div
          className={cn(
            "relative z-30 w-fit max-w-full",
            fadeClass,
            contentVisible
              ? "pointer-events-auto [&_*]:pointer-events-auto"
              : "pointer-events-none [&_*]:pointer-events-none"
          )}
        >
          {cta}
        </div>
      ) : null}
      {status ? (
        <div className="pointer-events-none mt-6 min-h-[1.25rem]">{status}</div>
      ) : null}
    </div>
  );
}
