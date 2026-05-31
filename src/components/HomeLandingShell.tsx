"use client";

import type { ReactNode } from "react";
import { HomeLandingTransitionProvider } from "@/components/HomeLandingTransition";
import { HomeSplineBackground } from "@/components/HomeSplineBackground";
import { HomeLandingNav } from "@/components/HomeLandingNav";
import { HomePageIntro } from "@/components/HomePageIntro";
import { HomeLandingFooter } from "@/components/HomeLandingFooter";
import { HomeAuthUiProvider } from "@/components/HomeAuthUiContext";

type HomeLandingShellProps = {
  introCta?: ReactNode;
  status?: ReactNode;
  footerExtra?: ReactNode;
};

export function HomeLandingShell({ introCta, status, footerExtra }: HomeLandingShellProps) {
  return (
    <HomeLandingTransitionProvider>
      <HomeAuthUiProvider>
        <div className="relative isolate flex min-h-[100dvh] min-h-screen flex-col overflow-hidden font-manrope">
          <HomeSplineBackground />
          <div className="pointer-events-none relative z-20 flex min-h-[100dvh] min-h-screen flex-1 flex-col">
            <HomeLandingNav />
            <div className="flex flex-1 flex-col justify-center px-6 md:px-10 lg:px-12 lg:pb-8">
              <HomePageIntro cta={introCta} status={status} />
            </div>
            <HomeLandingFooter>{footerExtra}</HomeLandingFooter>
          </div>
        </div>
      </HomeAuthUiProvider>
    </HomeLandingTransitionProvider>
  );
}
