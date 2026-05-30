"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const LOCALE_TRANSITION_STORAGE_KEY = "sozupay_locale_transition";
export const LANDING_CONTENT_FADE_MS = 400;

type HomeLandingTransitionContextValue = {
  contentVisible: boolean;
  beginLocaleSwitch: () => Promise<void>;
};

const HomeLandingTransitionContext =
  createContext<HomeLandingTransitionContextValue | null>(null);

export function HomeLandingTransitionProvider({ children }: { children: ReactNode }) {
  const [contentVisible, setContentVisible] = useState(true);

  useEffect(() => {
    const pending = sessionStorage.getItem(LOCALE_TRANSITION_STORAGE_KEY);
    if (!pending) return;
    sessionStorage.removeItem(LOCALE_TRANSITION_STORAGE_KEY);
    setContentVisible(false);
    const id = window.setTimeout(() => setContentVisible(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  const beginLocaleSwitch = useCallback(async () => {
    setContentVisible(false);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, LANDING_CONTENT_FADE_MS);
    });
  }, []);

  return (
    <HomeLandingTransitionContext.Provider value={{ contentVisible, beginLocaleSwitch }}>
      {children}
    </HomeLandingTransitionContext.Provider>
  );
}

export function useHomeLandingTransition() {
  const ctx = useContext(HomeLandingTransitionContext);
  if (!ctx) {
    throw new Error("useHomeLandingTransition must be used within HomeLandingTransitionProvider");
  }
  return ctx;
}

export function useHomeLandingTransitionOptional() {
  return useContext(HomeLandingTransitionContext);
}
