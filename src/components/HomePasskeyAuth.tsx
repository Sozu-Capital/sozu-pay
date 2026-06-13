"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  checkUsernameAvailable,
  createPasskey,
  fetchLoginChallenge,
  fetchRegisterChallenge,
  getPasskey,
  loginWithPin,
  registerWithPin,
  verifyLogin,
  verifyRegistration,
} from "@/lib/auth/passkey-client";
import {
  isPasskeySupported,
  isPasskeyUserCancel,
  shouldOfferPinFallback,
} from "@/lib/auth/passkey-fallback";
import { useHomeAuthUi } from "@/components/HomeAuthUiContext";
import { HomeLandingCta } from "@/components/HomeLandingCta";
import { cn } from "@/lib/utils";

type HomePasskeyAuthProps = {
  returnTo?: string;
  onBusyChange?: (busy: boolean) => void;
};

const secondaryLinkClass =
  "text-xs text-white/55 underline-offset-2 hover:text-white/80 hover:underline";

export function HomePasskeyAuth({ returnTo, onBusyChange }: HomePasskeyAuthProps) {
  const router = useRouter();
  const t = useTranslations("login");
  const {
    registerOpen,
    pinFallback,
    pinRegister,
    closeRegister,
    showPinFallback,
    showPinRegister,
    backToPasskeyRegister,
    resetToPasskeyLogin,
  } = useHomeAuthUi();

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setLoading = (v: boolean) => {
    setBusy(v);
    onBusyChange?.(v);
  };

  const cleanTag = username.replace(/^\$/, "").trim().toLowerCase();

  function goAfterAuth(redirect: string) {
    if (typeof window !== "undefined") {
      window.location.assign(redirect);
      return;
    }
    router.replace(redirect);
  }

  async function handlePasskeyLogin() {
    setError("");
    setLoading(true);
    try {
      const ch = await fetchLoginChallenge(undefined);
      const cred = await getPasskey(ch);
      const { redirect } = await verifyLogin({
        credential: cred,
        challenge: ch.challenge,
        returnTo,
      });
      goAfterAuth(redirect);
    } catch (e) {
      if (shouldOfferPinFallback(e)) {
        showPinFallback();
        setError(
          isPasskeySupported()
            ? t("passkeyLoginFailedTryPin")
            : t("passkeyNotSupportedTryPin")
        );
      } else if (!isPasskeyUserCancel(e)) {
        setError(e instanceof Error ? e.message : t("somethingWentWrong"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      if (cleanTag.length < 3) {
        setError(t("passkeyTagTooShort"));
        return;
      }
      const tagCheck = await checkUsernameAvailable(cleanTag);
      if (!tagCheck.available) {
        setError(
          tagCheck.error === "Invalid format" ? t("passkeyTagInvalid") : t("passkeyTagTaken")
        );
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
      goAfterAuth(redirect);
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
      goAfterAuth(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePinRegister() {
    setError("");
    setLoading(true);
    try {
      if (cleanTag.length < 3) {
        setError(t("passkeyTagTooShort"));
        return;
      }
      if (pin !== confirmPin) {
        setError(t("passkeyPinsDoNotMatch"));
        return;
      }
      const tagCheck = await checkUsernameAvailable(cleanTag);
      if (!tagCheck.available) {
        setError(
          tagCheck.error === "Invalid format" ? t("passkeyTagInvalid") : t("passkeyTagTaken")
        );
        return;
      }
      const { redirect } = await registerWithPin({
        username: cleanTag,
        pin,
        returnTo,
      });
      goAfterAuth(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none";

  const pinField = (
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
        autoComplete={pinRegister ? "new-password" : "current-password"}
        className={fieldClass}
      />
    </label>
  );

  if (registerOpen && pinRegister) {
    return (
      <div className="pointer-events-auto relative z-30 w-full max-w-md space-y-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
          {t("passkeyCreateWithPin")}
        </p>
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
            className={fieldClass}
          />
        </label>
        {pinField}
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
            {t("passkeyConfirmPinLabel")}
          </span>
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="••••••"
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
        {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePinRegister()}
          className={cn(
            "w-full rounded-full bg-white/90 py-3 text-sm font-medium tracking-wide text-black",
            "transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {busy ? t("redirecting") : t("passkeyCreateWithPinCta")}
        </button>
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              backToPasskeyRegister();
              setError("");
              setPin("");
              setConfirmPin("");
            }}
            className={cn(secondaryLinkClass, "text-left")}
          >
            {t("passkeyBackToPasskeyRegister")}
          </button>
          <button
            type="button"
            onClick={() => {
              closeRegister();
              setError("");
              setPin("");
              setConfirmPin("");
            }}
            className={cn(secondaryLinkClass, "text-right")}
          >
            {t("passkeyBackToLogin")}
          </button>
        </div>
      </div>
    );
  }

  if (registerOpen) {
    return (
      <div className="pointer-events-auto relative z-30 w-full max-w-md space-y-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{t("passkeyCreateAccount")}</p>
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
            className={fieldClass}
          />
        </label>
        {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleRegister()}
          className={cn(
            "w-full rounded-full bg-white/90 py-3 text-sm font-medium tracking-wide text-black",
            "transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {busy ? t("redirecting") : t("passkeyRegisterCta")}
        </button>
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              showPinRegister();
              setError("");
              setPin("");
              setConfirmPin("");
            }}
            className={cn(secondaryLinkClass, "text-left")}
          >
            {t("passkeyCreateWithPin")}
          </button>
          <button
            type="button"
            onClick={() => {
              closeRegister();
              setError("");
            }}
            className={cn(secondaryLinkClass, "text-right")}
          >
            {t("passkeyBackToLogin")}
          </button>
        </div>
      </div>
    );
  }

  if (pinFallback) {
    return (
      <div className="pointer-events-auto relative z-30 w-full max-w-md space-y-4">
        <p className="text-sm font-light text-white/70">{t("passkeyPinFallbackLead")}</p>
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
            className={fieldClass}
          />
        </label>
        {pinField}
        {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePinLogin()}
          className={cn(
            "w-full rounded-full bg-white/90 py-3 text-sm font-medium tracking-wide text-black",
            "transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {busy ? t("redirecting") : t("passkeySignInWithPin")}
        </button>
        <button
          type="button"
          onClick={() => {
            resetToPasskeyLogin();
            setError("");
            setPin("");
          }}
          className={secondaryLinkClass}
        >
          {t("passkeyTryPasskeyAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto relative z-30 w-fit max-w-md space-y-3">
      <HomeLandingCta disabled={busy} onClick={() => void handlePasskeyLogin()}>
        {busy ? t("redirecting") : t("homeCta")}
      </HomeLandingCta>
      <button
        type="button"
        onClick={() => {
          showPinFallback();
          setError("");
          setPin("");
        }}
        className={cn(secondaryLinkClass, "block")}
      >
        {t("passkeyUsePin")}
      </button>
      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
    </div>
  );
}
