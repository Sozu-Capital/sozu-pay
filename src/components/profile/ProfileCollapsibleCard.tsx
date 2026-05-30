"use client";

import { useState, type ReactNode } from "react";

export function ProfileCollapsibleCard({
  title,
  summary,
  openLabel,
  closeLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  openLabel: string;
  closeLabel: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-expanded={open}
        >
          {open ? closeLabel : openLabel}
        </button>
      </div>
      {open ? <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700/60">{children}</div> : null}
    </section>
  );
}
