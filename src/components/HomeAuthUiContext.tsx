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
  pinRegister: boolean;
  openRegister: () => void;
  closeRegister: () => void;
  showPinFallback: () => void;
  showPinRegister: () => void;
  backToPasskeyRegister: () => void;
  resetToPasskeyLogin: () => void;
};

const HomeAuthUiContext = createContext<HomeAuthUiContextValue | null>(null);

export function HomeAuthUiProvider({ children }: { children: ReactNode }) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pinFallback, setPinFallback] = useState(false);
  const [pinRegister, setPinRegister] = useState(false);

  const openRegister = useCallback(() => {
    setRegisterOpen(true);
    setPinFallback(false);
    setPinRegister(false);
  }, []);

  const closeRegister = useCallback(() => {
    setRegisterOpen(false);
    setPinRegister(false);
  }, []);

  const showPinFallback = useCallback(() => {
    setPinFallback(true);
    setRegisterOpen(false);
    setPinRegister(false);
  }, []);

  const showPinRegister = useCallback(() => {
    setRegisterOpen(true);
    setPinRegister(true);
    setPinFallback(false);
  }, []);

  const backToPasskeyRegister = useCallback(() => {
    setPinRegister(false);
    setRegisterOpen(true);
    setPinFallback(false);
  }, []);

  const resetToPasskeyLogin = useCallback(() => {
    setPinFallback(false);
    setRegisterOpen(false);
    setPinRegister(false);
  }, []);

  const value = useMemo(
    () => ({
      registerOpen,
      pinFallback,
      pinRegister,
      openRegister,
      closeRegister,
      showPinFallback,
      showPinRegister,
      backToPasskeyRegister,
      resetToPasskeyLogin,
    }),
    [
      registerOpen,
      pinFallback,
      pinRegister,
      openRegister,
      closeRegister,
      showPinFallback,
      showPinRegister,
      backToPasskeyRegister,
      resetToPasskeyLogin,
    ]
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
