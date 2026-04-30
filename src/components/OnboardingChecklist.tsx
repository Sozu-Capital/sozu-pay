"use client";

import { useTranslations } from "next-intl";

export default function OnboardingChecklist() {
  const t = useTranslations("onboardingChecklist");
  const items = [
    { label: t("bank"), href: "/dashboard/settings#bank", done: false },
    { label: t("wall"), href: "/dashboard/walls", done: false },
    { label: t("store"), href: "/dashboard/settings#stores", done: false },
  ];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        {t("title")}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
            <a
              href={item.href}
              className="text-sm text-gray-700 dark:text-gray-300 hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
