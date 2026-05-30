"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type HomeLandingCtaProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

/** Pill CTA — glassmorphism white surface, black label. */
export function HomeLandingCta({ children, className, ...props }: HomeLandingCtaProps) {
  return (
    <button
      type="button"
      className={cn(
        "!pointer-events-auto relative z-30 mt-10 inline-flex items-center justify-center rounded-full px-9 py-3.5",
        "bg-white/80 text-sm font-medium text-black backdrop-blur-xl",
        "border border-white/50 shadow-[0_8px_32px_rgba(255,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.6)]",
        "transition-all hover:bg-white/95 hover:shadow-[0_12px_40px_rgba(255,255,255,0.2)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
