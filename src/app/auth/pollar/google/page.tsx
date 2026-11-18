"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SozuLoadingMark } from "@/components/SozuLoadingMark";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import {
  clearPollarHandoffUrl,
  consumePollarHandoffUrl,
  isAllowedPollarHandoffUrl,
  parsePollarHandoffUrl,
  POLLAR_OAUTH_HANDOFF_CHANNEL,
  POLLAR_OAUTH_HANDOFF_KEY,
  POLLAR_OAUTH_HANDOFF_MESSAGE,
} from "@/lib/pollar/oauth-resume";

function handoffUrlFromUnknown(data: unknown): string | null {
  if (typeof data === "string") {
    return isAllowedPollarHandoffUrl(data) ? data : null;
  }
  if (!data || typeof data !== "object") return null;
  const payload = data as { type?: unknown; url?: unknown };
  if (payload.type !== POLLAR_OAUTH_HANDOFF_MESSAGE) return null;
  if (typeof payload.url !== "string") return null;
  return isAllowedPollarHandoffUrl(payload.url) ? payload.url : null;
}

/**
 * Same-origin placeholder opened from Continue with Google. Waits for the
 * Pollar/Google URL, then replaces this tab. The original SozuPay tab stays put.
 */
export default function PollarGoogleHandoffPage() {
  const t = useTranslations("login");
  const [stuck, setStuck] = useState(false);
  const navigated = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setStuck(true), 15_000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const go = (url: string) => {
      if (navigated.current) return;
      if (!isAllowedPollarHandoffUrl(url)) return;
      navigated.current = true;
      clearPollarHandoffUrl();
      window.location.replace(url);
    };

    const existing = consumePollarHandoffUrl();
    if (existing) {
      go(existing);
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== POLLAR_OAUTH_HANDOFF_KEY || !event.newValue) return;
      const url = parsePollarHandoffUrl(event.newValue, Date.now());
      if (url) go(url);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const url = handoffUrlFromUnknown(event.data);
      if (url) go(url);
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(POLLAR_OAUTH_HANDOFF_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const url = handoffUrlFromUnknown(event.data);
        if (url) go(url);
      };
    } catch {
      // BroadcastChannel unavailable
    }

    const poll = window.setInterval(() => {
      const url = consumePollarHandoffUrl();
      if (url) go(url);
    }, 250);

    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      try {
        channel?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <DarkGradientBg>
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-white">
        <SozuLoadingMark mode="inline" />
        <p className="text-sm text-white/70">{t("googleOpening")}</p>
        {stuck ? (
          <div className="mt-4 max-w-sm space-y-3 text-center">
            <p className="text-sm text-white/70">{t("googleHandoffStuck")}</p>
            <Link href="/" className="inline-block text-sm underline underline-offset-2">
              {t("goHome")}
            </Link>
          </div>
        ) : null}
      </main>
    </DarkGradientBg>
  );
}
