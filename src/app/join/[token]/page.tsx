"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
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
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAuthed(!!d?.user))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed || preview.status !== "ready" || !token || acceptedRef.current) return;
    acceptedRef.current = true;
    setAcceptBusy(true);
    setAcceptError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/org/invites/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? t("acceptFailed"));
        }
        router.replace(typeof data.redirect === "string" ? data.redirect : "/dashboard");
      } catch (e) {
        acceptedRef.current = false;
        setAcceptError(e instanceof Error ? e.message : t("acceptFailed"));
      } finally {
        setAcceptBusy(false);
      }
    })();
  }, [authed, preview.status, token, router, t]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t("title")}</h1>

        {preview.status === "loading" && (
          <p className="text-sm text-gray-500">{t("loading")}</p>
        )}

        {preview.status === "error" && (
          <p className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {preview.message}
          </p>
        )}

        {preview.status === "ready" && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("inviteTo", { org: preview.orgName, role: preview.role })}
            </p>
            {acceptError && (
              <p className="text-sm text-red-600 dark:text-red-400">{acceptError}</p>
            )}
            {authed === false && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t("signInPrompt")}</p>
                <HomePollarAuth returnTo={`/join/${encodeURIComponent(token)}`} />
              </div>
            )}
            {authed === true && (
              <p className="text-sm text-gray-500">{t("joining")}</p>
            )}
          </>
        )}

        <p className="text-xs text-gray-400">
          <Link href="/" className="underline underline-offset-2 hover:text-gray-600">
            {t("backHome")}
          </Link>
        </p>
      </div>
    </main>
  );
}
