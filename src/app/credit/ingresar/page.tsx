"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CreditIngresarPage() {
  const t = useTranslations("creditPortal");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/credit/mock-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error");
        return;
      }
      router.push("/credit/solicitud/datos-generales");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Link href="/credit" className="text-sm text-blue-600 dark:text-blue-400">
        ← {t("backHome")}
      </Link>
      <h1 className="text-2xl font-bold mt-6 text-gray-900 dark:text-white">
        {t("ingresarTitle")}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("ingresarBody")}</p>

      <form onSubmit={onNext} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("emailLabel")}
          <input
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@ejemplo.com"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {loading ? "…" : t("next")}
        </button>
      </form>
    </div>
  );
}
