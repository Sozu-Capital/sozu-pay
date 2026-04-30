"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        {t("errorTitle")}
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400 text-center max-w-md">
        {t("errorBody")}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium"
        >
          {t("tryAgain")}
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
        >
          {t("goHome")}
        </Link>
      </div>
    </main>
  );
}
