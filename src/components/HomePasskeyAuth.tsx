"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createPasskey,
  fetchLoginChallenge,
  fetchRegisterChallenge,
  getPasskey,
  loginWithPin,
  verifyLogin,
  verifyRegistration,
} from "@/lib/auth/passkey-client";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

type HomePasskeyAuthProps = {
  returnTo?: string;
  onBusyChange?: (busy: boolean) => void;
};

export function HomePasskeyAuth({ returnTo, onBusyChange }: HomePasskeyAuthProps) {
  const router = useRouter();
  const t = useTranslations("login");
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setLoading = (v: boolean) => {
    setBusy(v);
    onBusyChange?.(v);
  };

  const cleanTag = username.replace(/^\$/, "").trim().toLowerCase();

  async function handlePasskey() {
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (cleanTag.length < 3) {
          setError(t("passkeyTagTooShort"));
          return;
        }
        const ch = await fetchRegisterChallenge(cleanTag);
        const cred = await createPasskey(ch);
        const { redirect } = await verifyRegistration({
          username: cleanTag,
          credential: cred,
          challenge: ch.challenge,
          returnTo,
        });
        router.replace(redirect);
        return;
      }

      const ch = await fetchLoginChallenge(cleanTag || undefined);
      const cred = await getPasskey(ch);
      const { redirect } = await verifyLogin({
        username: cleanTag || undefined,
        credential: cred,
        challenge: ch.challenge,
        returnTo,
      });
      router.replace(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePinLogin() {
    setError("");
    setLoading(true);
    try {
      if (cleanTag.length < 3) {
        setError(t("passkeyTagTooShort"));
        return;
      }
      const { redirect } = await loginWithPin({
        username: cleanTag,
        pin,
        returnTo,
      });
      router.replace(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pointer-events-auto relative z-30 w-full max-w-md space-y-4">
      <div className="flex rounded-full border border-white/20 bg-black/30 p-0.5 backdrop-blur-md">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={cn(
              "flex-1 rounded-full py-2 text-xs font-medium tracking-wide transition-colors",
              mode === m ? "bg-white/90 text-black" : "text-white/70 hover:text-white"
            )}
          >
            {m === "login" ? t("passkeySignIn") : t("passkeyCreateAccount")}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
          {t("passkeyTagLabel")}
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("passkeyTagPlaceholder")}
          autoComplete="username"
          className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
      </label>

      {mode === "login" && (
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={usePin}
            onChange={(e) => setUsePin(e.target.checked)}
            className="rounded border-white/30"
          />
          {t("passkeyUseBackupPin")}
        </label>
      )}

      {usePin && mode === "login" && (
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
            {t("passkeyPinLabel")}
          </span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="••••••"
            autoComplete="current-password"
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
          />
        </label>
      )}

      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => (usePin && mode === "login" ? handlePinLogin() : handlePasskey())}
        className={cn(
          "w-full rounded-full bg-white/90 py-3 text-sm font-medium tracking-wide text-black",
          "transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {busy
          ? t("redirecting")
          : usePin && mode === "login"
            ? t("passkeySignInWithPin")
            : mode === "register"
              ? t("passkeyRegisterCta")
              : t("passkeySignInCta")}
      </button>
    </div>
  );
}
