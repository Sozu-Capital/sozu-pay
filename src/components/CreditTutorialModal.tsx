"use client";

import { useEffect, useState } from "react";

type CreditTutorialModalProps = {
  storageKey: string;
  title: string;
  intro: string;
  steps: string[];
  /** Segunda pantalla: privacidad y uso de datos. */
  privacyTitle: string;
  privacyParagraphs: string[];
  nextLabel: string;
  ctaLabel: string;
};

export function CreditTutorialModal({
  storageKey,
  title,
  intro,
  steps,
  privacyTitle,
  privacyParagraphs,
  nextLabel,
  ctaLabel,
}: CreditTutorialModalProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<1 | 2>(1);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(storageKey)) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const headingId =
    page === 1 ? "credit-tutorial-title" : "credit-tutorial-privacy-title";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label={page === 1 ? "Continuar" : "Cerrar"}
        onClick={() => (page === 1 ? setPage(2) : dismiss())}
      />
      <div className="relative z-10 w-full max-w-md max-h-[min(90vh,32rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <p className="mb-3 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
          {page} / 2
        </p>

        {page === 1 ? (
          <>
            <h2
              id="credit-tutorial-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{intro}</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
              {steps.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPage(2)}
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {nextLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="credit-tutorial-privacy-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {privacyTitle}
            </h2>
            <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {privacyParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {ctaLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
