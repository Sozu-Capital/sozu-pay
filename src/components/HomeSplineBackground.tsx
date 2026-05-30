"use client";

import { useCallback, useEffect, useState } from "react";
import { HomePageHero } from "@/components/HomePageHero";

const SPLINE_EMBED_URL =
  "https://my.spline.design/theeternalarc-woEnIpCp6uQ5GVmVkPkr1BqK-WkG/";

/** If the embed never fires load, show the static logo fallback. */
const SPLINE_LOAD_TIMEOUT_MS = 14_000;

/**
 * Full-viewport Spline (fixed on mobile for true edge-to-edge height).
 * UI above uses pointer-events-none except CTA/chrome.
 */
export function HomeSplineBackground() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const onLoad = useCallback(() => {
    setLoaded(true);
    setFailed(false);
  }, []);
  const onError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setFailed(true), SPLINE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const showLogoFallback = failed && !loaded;

  return (
    <div
      className="fixed inset-0 z-[5] h-[100dvh] min-h-[100dvh] w-full overflow-hidden md:absolute md:inset-0 md:h-full md:min-h-full"
      aria-hidden
    >
      {showLogoFallback ? <HomePageHero /> : null}

      {/* Vignettes behind iframe so mobile touches reach the embed (overlays on top block iOS). */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.05) 70%, transparent 90%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black/35 via-transparent to-black/15" />

      {!showLogoFallback ? (
        <div
          className="absolute inset-0 z-[1] h-full w-full opacity-[0.42]"
          style={{
            transform: "scale(-1.2, 1.2)",
            transformOrigin: "center center",
          }}
        >
          <iframe
            src={SPLINE_EMBED_URL}
            title="Sozu background animation"
            className="pointer-events-auto h-full min-h-[100dvh] w-full border-0 touch-manipulation md:min-h-full"
            style={{ WebkitTouchCallout: "none" }}
            loading="eager"
            onLoad={onLoad}
            onError={onError}
          />
        </div>
      ) : null}
    </div>
  );
}
