"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { HomePollarAuth } from "@/components/HomePollarAuth";

type Preview =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      orgName: string;
      role: string;
      expiresAt: string | null;
    };

export default function JoinInvitePage() {
  const t = useTranslations("staffInvite");
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const joinPath = token ? `/join/${encodeURIComponent(token)}` : "";
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setPreview({ status: "error", message: t("invalid") });
      return;
    }
    fetch(`/api/org/invites/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setPreview({ status: "error", message: data.error ?? t("invalid") });
          return;
        }
        setPreview({
          status: "ready",
          orgName: data.orgName,
          role: data.role,
          expiresAt: data.expiresAt ?? null,
        });
      })
      .catch(() => setPreview({ status: "error", message: t("invalid") }));
  }, [token, t]);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setAuthed(!!d?.user);
        })
        .catch(() => {
          if (!cancelled) setAuthed(false);
        });
    void check();
    const retry = window.setTimeout(() => void check(), 800);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    if (!authed || preview.status !== "ready" || !token || acceptedRef.current) return;
    acceptedRef.current = true;
    setAcceptError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/org/invites/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.code === "ALREADY_USED") {
            router.replace("/dashboard");
            return;
          }
          throw new Error(data.error ?? t("acceptFailed"));
        }
        router.replace(typeof data.redirect === "string" ? data.redirect : "/dashboard");
      } catch (e) {
        acceptedRef.current = false;
        setAcceptError(e instanceof Error ? e.message : t("acceptFailed"));
      }
    })();
  }, [authed, preview.status, token, router, t]);

  return (
    <DarkGradientBg>
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center text-white">
          <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>

          {preview.status === "loading" && (
            <p className="text-sm text-white/70">{t("loading")}</p>
          )}

          {preview.status === "error" && (
            <p className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {preview.message}
            </p>
          )}

          {preview.status === "ready" && (
            <>
              <p className="text-sm text-white/80">
                {t("inviteTo", { org: preview.orgName, role: preview.role })}
              </p>
              {acceptError && (
                <p className="text-sm text-red-300">{acceptError}</p>
              )}
              {authed === false && (
                <div className="rounded-xl border border-white/15 bg-black/40 p-4">
                  <p className="mb-3 text-sm text-white/70">{t("signInPrompt")}</p>
                  <HomePollarAuth returnTo={joinPath} />
                </div>
              )}
              {authed === true && (
                <p className="text-sm text-white/70">{t("joining")}</p>
              )}
            </>
          )}

          <p className="text-xs text-white/45">
            <Link href="/" className="underline underline-offset-2 hover:text-white">
              {t("backHome")}
            </Link>
          </p>
        </div>
      </main>
    </DarkGradientBg>
  );
}
