"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function FeedbackButton({ className }: { className?: string }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      setFailed(true);
      setNotice(t("empty"));
      return;
    }
    setSending(true);
    setFailed(false);
    setNotice(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, path: pathname }),
      });
      if (!res.ok) {
        setFailed(true);
        setNotice(t("failed"));
        return;
      }
      setMessage("");
      setFailed(false);
      setNotice(t("sent"));
    } catch {
      setFailed(true);
      setNotice(t("failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setNotice(null);
          setFailed(false);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M7.5 8.25h9m-9 3.75h5.25M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337L5.26 21.5a.75.75 0 01-1.014-.917l.674-2.204A8.22 8.22 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        {t("label")}
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-2 space-y-2 px-1">
          <label className="sr-only" htmlFor="sidebar-feedback">
            {t("placeholder")}
          </label>
          <textarea
            id="sidebar-feedback"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("placeholder")}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {notice ? (
            <p className={`text-xs ${failed ? "text-red-300" : "text-emerald-300"}`}>{notice}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={sending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {sending ? t("sending") : t("send")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-white"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
