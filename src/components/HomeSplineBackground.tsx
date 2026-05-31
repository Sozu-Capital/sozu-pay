"use client";

import { useCallback, useEffect, useState } from "react";
import { HomePageHero } from "@/components/HomePageHero";

const SPLINE_EMBED_URL =
  "https://my.spline.design/theeternalarc-woEnIpCp6uQ5GVmVkPkr1BqK-WkG/";

/** If the embed never fires load, show the static logo fallback. */
const SPLINE_LOAD_TIMEOUT_MS = 14_000;
const SPLINE_MOBILE_MQ = "(max-width: 767px)";

/**
 * Mobile-only Spline (fixed, top-aligned). Desktop uses DarkGradientBg like other auth pages.
 * UI above uses pointer-events-none except CTA/chrome.
 */
export function HomeSplineBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(SPLINE_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const onLoad = useCallback(() => {
    setLoaded(true);
    setFailed(false);
  }, []);
  const onError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (!isMobile || loaded) return;
    const timer = window.setTimeout(() => setFailed(true), SPLINE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isMobile, loaded]);

  if (!isMobile) return null;

  const showLogoFallback = failed && !loaded;

  return (
    <div
      className="home-spline-root pointer-events-none hidden h-[100svh] w-full overflow-hidden max-md:fixed max-md:inset-0 max-md:z-[5] max-md:block max-md:min-h-0"
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
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden opacity-[0.42]">
          <div className="home-spline-embed-layer pointer-events-none h-full w-full">
            <iframe
              src={SPLINE_EMBED_URL}
              title="Sozu background animation"
              className="home-spline-iframe pointer-events-auto h-full w-full border-0 touch-manipulation"
              style={{ WebkitTouchCallout: "none" }}
              loading="eager"
              onLoad={onLoad}
              onError={onError}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
