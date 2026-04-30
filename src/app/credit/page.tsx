"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CreditTutorialModal } from "@/components/CreditTutorialModal";

const CREDIT_LANDING_TUTORIAL_KEY = "sozu-credit-tutorial-landing-v1";

export default function CreditLandingPage() {
  const t = useTranslations("creditPortal");

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <CreditTutorialModal
        storageKey={CREDIT_LANDING_TUTORIAL_KEY}
        title={t("tutorialLandingTitle")}
        intro={t("tutorialLandingIntro")}
        steps={[
          t("tutorialLandingStep1"),
          t("tutorialLandingStep2"),
          t("tutorialLandingStep3"),
          t("tutorialLandingStep4"),
        ]}
        privacyTitle={t("tutorialPrivacyTitle")}
        privacyParagraphs={[
          t("tutorialPrivacyP1"),
          t("tutorialPrivacyP2"),
          t("tutorialPrivacyP3"),
        ]}
        nextLabel={t("tutorialLandingNext")}
        ctaLabel={t("tutorialLandingCta")}
      />
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t("landingTitle")}
      </h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">{t("landingBody")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/credit/ingresar"
          className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {t("ctaApply")}
        </Link>
        <Link
          href="/credit/renovar"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t("ctaRenew")}
        </Link>
        <Link
          href="/credit/my-loans"
          className="inline-flex rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t("ctaMyLoans")}
        </Link>
      </div>
    </div>
  );
}
