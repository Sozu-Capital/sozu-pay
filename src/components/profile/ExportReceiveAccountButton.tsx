"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { exportReceiveAccount, mainnetReceiveAccountEnabled } from "@/lib/stellar/receive-account-client";

export function ExportReceiveAccountButton() {
  const t = useTranslations("profilePage");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!mainnetReceiveAccountEnabled()) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setSecret(null);
          setPending(true);
          exportReceiveAccount()
            .then(setSecret)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : t("exportReceiveFailed")))
            .finally(() => setPending(false));
        }}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
      >
        {pending ? t("exportReceiveWorking") : t("exportReceiveAccount")}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {secret ? (
        <p className="mt-2 break-all font-mono text-sm text-gray-800 dark:text-gray-200">{secret}</p>
      ) : null}
    </div>
  );
}
