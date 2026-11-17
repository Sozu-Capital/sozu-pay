"use client";

import { useTranslations } from "next-intl";
import SendStellarRecipient from "@/components/SendStellarRecipient";

export default function SendPage() {
  const t = useTranslations("sendPage");

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>
      <SendStellarRecipient />
    </div>
  );
}
