"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function isPublicCreditPath(pathname: string): boolean {
  if (pathname === "/credit" || pathname === "/credit/") return true;
  if (pathname.startsWith("/credit/ingresar")) return true;
  return false;
}

/**
 * Credit portal: mock email session or Privy. Redirects protected routes to /credit/ingresar if no session.
 */
export function CreditPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(isPublicCreditPath(pathname));

  useEffect(() => {
    if (isPublicCreditPath(pathname)) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/credit/ingresar");
          return;
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-600 dark:text-gray-400">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
