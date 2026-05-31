"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HomeAuthUiContextValue = {
  registerOpen: boolean;
  pinFallback: boolean;
  openRegister: () => void;
  closeRegister: () => void;
  showPinFallback: () => void;
  resetToPasskeyLogin: () => void;
};

const HomeAuthUiContext = createContext<HomeAuthUiContextValue | null>(null);

export function HomeAuthUiProvider({ children }: { children: ReactNode }) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pinFallback, setPinFallback] = useState(false);

  const openRegister = useCallback(() => {
    setRegisterOpen(true);
    setPinFallback(false);
  }, []);

  const closeRegister = useCallback(() => {
    setRegisterOpen(false);
  }, []);

  const showPinFallback = useCallback(() => {
    setPinFallback(true);
    setRegisterOpen(false);
  }, []);

  const resetToPasskeyLogin = useCallback(() => {
    setPinFallback(false);
    setRegisterOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      registerOpen,
      pinFallback,
      openRegister,
      closeRegister,
      showPinFallback,
      resetToPasskeyLogin,
    }),
    [registerOpen, pinFallback, openRegister, closeRegister, showPinFallback, resetToPasskeyLogin]
  );

  return <HomeAuthUiContext.Provider value={value}>{children}</HomeAuthUiContext.Provider>;
}

export function useHomeAuthUi(): HomeAuthUiContextValue {
  const ctx = useContext(HomeAuthUiContext);
  if (!ctx) {
    throw new Error("useHomeAuthUi must be used within HomeAuthUiProvider");
  }
  return ctx;
}

export function useHomeAuthUiOptional(): HomeAuthUiContextValue | null {
  return useContext(HomeAuthUiContext);
}
