"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

type HomeLandingFooterProps = {
  children?: ReactNode;
};

export function HomeLandingFooter({ children }: HomeLandingFooterProps) {
  const t = useTranslations("login");

  return (
    <footer className="pointer-events-none relative z-20 flex items-end justify-between px-6 pb-8 pt-4 md:px-10 lg:px-12">
      <p className="pointer-events-none font-manrope text-[10px] uppercase tracking-[0.28em] text-white/35">
        {t("homeExplore")}
      </p>
      {children ? (
        <div className="pointer-events-auto flex flex-col items-end gap-2">{children}</div>
      ) : null}
    </footer>
  );
}
