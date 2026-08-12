"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OrgSetupStepKey = "org" | "passkey" | "register" | "treasury" | "wallet" | "sozuTag";

const DEFAULT_STEP_ORDER: OrgSetupStepKey[] = ["org", "passkey", "register", "treasury", "sozuTag"];

function StepIcon({ step, active }: { step: OrgSetupStepKey; active: boolean }) {
  const className = cn(
    "h-5 w-5",
    active ? "text-white" : "text-white/35"
  );

  switch (step) {
    case "org":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        </svg>
      );
    case "passkey":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z" />
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v2a6 6 0 01-6 6 6 6 0 01-6-6v-2z" />
        </svg>
      );
    case "register":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
        </svg>
      );
    case "treasury":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7h8M7 12h10M6 17h12" />
        </svg>
      );
    case "wallet":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M16 12h.01M3 10h18" />
        </svg>
      );
    case "sozuTag":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6M7 16h8" />
          <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
        </svg>
      );
  }
}

type OrgCreateSetupProgressProps = {
  currentStep: OrgSetupStepKey;
  stepLabels: Partial<Record<OrgSetupStepKey, string>>;
  stepOrder?: OrgSetupStepKey[];
  spinner?: ReactNode;
  title: string;
  subtitle: string;
  hint?: string;
};

export function OrgCreateSetupProgress({
  currentStep,
  stepLabels,
  stepOrder = DEFAULT_STEP_ORDER,
  spinner,
  title,
  subtitle,
  hint,
}: OrgCreateSetupProgressProps) {
  const currentIndex = Math.max(0, stepOrder.indexOf(currentStep));

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 shadow-xl text-center">
      <div className="flex items-center justify-center gap-2 sm:gap-3" aria-hidden>
        {stepOrder.map((key, index) => {
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
          return (
            <div key={key} className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                  state === "active" && "border-white/50 bg-white/15",
                  state === "done" && "border-emerald-500/50 bg-emerald-500/15",
                  state === "pending" && "border-white/15 bg-black/20"
                )}
              >
                <StepIcon step={key} active={state !== "pending"} />
              </div>
              <span
                className={cn(
                  "max-w-[4.5rem] text-[9px] leading-tight tracking-wide",
                  state === "active" ? "text-white/90" : "text-white/40"
                )}
              >
                {stepLabels[key] ?? key}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">{spinner}</div>
      <h1 className="mt-6 text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-300">{subtitle}</p>
      {hint ? <p className="mt-4 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
