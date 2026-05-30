"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

type HomePageIntroProps = {
  cta?: ReactNode;
  status?: ReactNode;
};

export function HomePageIntro({ cta, status }: HomePageIntroProps) {
  const t = useTranslations("login");

  return (
    <div className="pointer-events-none relative z-20 max-w-xl lg:max-w-2xl [&_*]:pointer-events-none">
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
      {cta ? (
        <div className="!pointer-events-auto relative z-30 [&_*]:pointer-events-auto">{cta}</div>
      ) : null}
      {status ? (
        <div className="pointer-events-none mt-6 min-h-[1.25rem]">{status}</div>
      ) : null}
    </div>
  );
}
