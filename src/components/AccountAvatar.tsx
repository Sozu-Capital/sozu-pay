"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { orgSwitcherInitials } from "@/lib/org/org-switcher";
import { AVATAR_DATA_URL_MAX_LENGTH } from "@/lib/avatar";
import { fileToAvatarDataUrl } from "@/lib/avatar-image";

export const AVATAR_CHANGED_EVENT = "sozupay:avatar";

function readLocalAvatar(storageKey: string | null): string | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeLocalAvatar(storageKey: string | null, value: string | null) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
}

export function AccountAvatar({
  name,
  imageUrl,
  storageKey = null,
  uploadUrl,
  size = 36,
  onChange,
}: {
  name: string;
  imageUrl?: string | null;
  storageKey?: string | null;
  /** When set, the circle opens a file picker and saves the portrait here. */
  uploadUrl?: string;
  size?: number;
  onChange?: (url: string | null) => void;
}) {
  const t = useTranslations("profilePage");
  const inputId = useId();
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalUrl(readLocalAvatar(storageKey));
    const sync = () => setLocalUrl(readLocalAvatar(storageKey));
    window.addEventListener(AVATAR_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AVATAR_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey]);

  const shown = imageUrl || localUrl;
  const initials = orgSwitcherInitials(name || "?");

  async function persist(next: string | null) {
    setError(null);
    setBusy(true);
    try {
      if (uploadUrl) {
        const res = await fetch(uploadUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && data.code !== "AVATAR_COLUMN_MISSING") {
          setError(typeof data.error === "string" ? data.error : t("photoFailed"));
          return;
        }
      }
      writeLocalAvatar(storageKey, next);
      setLocalUrl(next);
      onChange?.(next);
    } catch {
      setError(t("photoFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("photoInvalid"));
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (dataUrl.length > AVATAR_DATA_URL_MAX_LENGTH) {
        setError(t("photoTooLarge"));
        return;
      }
      await persist(dataUrl);
    } catch {
      setError(t("photoInvalid"));
    }
  }

  const circle = (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) }}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );

  if (!uploadUrl) return circle;

  return (
    <div className="flex flex-col items-start gap-2">
      <label htmlFor={inputId} className={`relative cursor-pointer ${busy ? "opacity-60" : ""}`}>
        {circle}
        <span className="sr-only">{t("changePhoto")}</span>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
      </label>
      <div className="flex gap-3 text-xs">
        <label htmlFor={inputId} className="cursor-pointer text-blue-400 hover:underline">
          {t("changePhoto")}
        </label>
        {shown ? (
          <button
            type="button"
            className="text-gray-400 hover:text-white"
            disabled={busy}
            onClick={() => void persist(null)}
          >
            {t("removePhoto")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
