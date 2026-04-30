import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400 text-center">
        {t("notFoundBody")}
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium"
      >
        {t("goHome")}
      </Link>
      <Link
        href="/dashboard"
        className="mt-3 text-sm text-gray-500 dark:text-gray-400 underline"
      >
        {t("dashboard")}
      </Link>
    </main>
  );
}
