"use client";

import { useTranslations } from "next-intl";
import SendStellarRecipient from "@/components/SendStellarRecipient";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

export default function SendPage() {
  const t = useTranslations("sendPage");
  const dash = useDashboardProfile();
  const canSendPizza = !!dash?.profile?.can_send_pizza;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {canSendPizza ? t("subtitleWithPizza") : t("subtitle")}
      </p>
      <SendStellarRecipient />
    </div>
  );
}
