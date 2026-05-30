"use client";

import { createContext, useContext, type ReactNode } from "react";

type SignOutContextValue = {
  privyLogout: (() => Promise<void>) | null;
};

const SignOutContext = createContext<SignOutContextValue>({ privyLogout: null });

export function SignOutProvider({
  privyLogout,
  children,
}: {
  privyLogout: (() => Promise<void>) | null;
  children: ReactNode;
}) {
  return (
    <SignOutContext.Provider value={{ privyLogout }}>{children}</SignOutContext.Provider>
  );
}

export function usePrivyLogoutFromContext(): (() => Promise<void>) | null {
  return useContext(SignOutContext).privyLogout;
}
