import type React from "react";
import { cn } from "@/lib/utils";

interface DarkGradientBgProps {
  children?: React.ReactNode;
  className?: string;
  /** Stronger texture for landing so pattern shows behind Spline. */
  landing?: boolean;
  /** Standard auth background on desktop; stronger texture on mobile (behind Spline). */
  mobileLanding?: boolean;
}

export function DarkGradientBg({
  children,
  className,
  landing = false,
  mobileLanding = false,
}: DarkGradientBgProps) {
  const patternOpacity =
    landing || mobileLanding
      ? mobileLanding && !landing
        ? "opacity-5 max-md:opacity-[0.12]"
        : "opacity-[0.12]"
      : "opacity-5";
  const dotsOpacity =
    landing || mobileLanding
      ? mobileLanding && !landing
        ? "opacity-20 max-md:opacity-30"
        : "opacity-30"
      : "opacity-20";
  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-black",
        className
      )}
    >
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-100"
          style={{
            background:
              "radial-gradient(100% 100% at 0% 0%, rgb(46, 46, 46) 0%, rgb(0, 0, 0) 100%)",
            mask: "radial-gradient(125% 100% at 0% 0%, rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0.224) 88.2883%, rgba(0, 0, 0, 0) 100%)",
          }}
        >
          {/* Skewed fading blue streaks */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0) 36%, rgb(0, 0, 0) 55%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 11%, rgb(0, 0, 0) 25%, rgba(0, 0, 0, 0.55) 41%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 9%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0.55) 28%, rgba(0, 0, 0, 0.424) 40%, rgb(0, 0, 0) 48%, rgba(0, 0, 0, 0.267) 54%, rgba(0, 0, 0, 0.13) 78%, rgb(0, 0, 0) 88%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 17%, rgba(0, 0, 0, 0.55) 26%, rgb(0, 0, 0) 35%, rgba(0, 0, 0, 0) 47%, rgba(0, 0, 0, 0.13) 69%, rgb(0, 0, 0) 79%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0.55) 27%, rgb(0, 0, 0) 42%, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 74%, rgb(0, 0, 0) 82%, rgba(0, 0, 0, 0.47) 88%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
        </div>
      </div>

      <div
        className={cn("absolute inset-0 bg-repeat", patternOpacity)}
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1557683316-973673baf926?w=200&q=10")`,
          backgroundSize: "149.76px",
        }}
      />
      {/* Subtle dot pattern overlay */}
      <div
        className={cn("absolute inset-0", dotsOpacity)}
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Subtle radial highlight */}
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(30, 41, 59, 0.2) 0%, transparent 70%)",
        }}
      />

      {/* Content (landing layers use z-[5] spline + z-20 copy above) */}
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
