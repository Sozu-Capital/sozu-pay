"use client";

import { useTranslations } from "next-intl";
import { HomeLandingCta } from "@/components/HomeLandingCta";

type MerchantsBetaScreenProps = {
  onAcknowledge: () => void;
};

function Divider() {
  return <hr className="my-6 border-white/15" aria-hidden />;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm font-light leading-relaxed text-gray-300/95">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-white/40" aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function MerchantsBetaScreen({ onAcknowledge }: MerchantsBetaScreenProps) {
  const t = useTranslations("merchantsBeta");

  const posBullets = [
    t("posBullet1"),
    t("posBullet2"),
    t("posBullet3"),
    t("posBullet4"),
    t("posBullet5"),
  ];

  const founderBullets = [
    t("foundersBullet1"),
    t("foundersBullet2"),
    t("foundersBullet3"),
    t("foundersBullet4"),
  ];

  const steps = [
    t("howStep1"),
    t("howStep2"),
    t("howStep3"),
    t("howStep4"),
    t("howStep5"),
  ];

  return (
    <div className="pointer-events-auto relative z-30 flex w-full max-w-xl flex-col lg:max-w-2xl">
      <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        <h1 className="font-manrope text-2xl font-light uppercase leading-[1.2] tracking-[0.12em] text-white sm:text-3xl">
          {t("title")}
        </h1>

        <p className="mt-4 text-sm font-light leading-relaxed text-gray-300/95 sm:text-base">
          {t("lead1")}
        </p>
        <p className="mt-3 text-sm font-light leading-relaxed text-gray-400 sm:text-[15px]">
          {t("lead2")}
        </p>
        <p className="mt-3 text-sm font-light leading-relaxed text-gray-400 sm:text-[15px]">
          {t("lead3")}
        </p>
        <p className="mt-3 text-sm font-light leading-relaxed text-gray-400 sm:text-[15px]">
          {t("lead4")}
        </p>

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("posTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("posIntro")}</p>
        <p className="mt-2 text-sm text-gray-400">{t("posCanDo")}</p>
        <BulletList items={posBullets} />

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("supportTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("supportBody1")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("supportBody2")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("supportBody3")}</p>

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("customersTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("customersBody1")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("customersBody2")}</p>

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("foundersTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("foundersIntro")}</p>
        <p className="mt-2 text-sm text-gray-400">{t("foundersIncluding")}</p>
        <BulletList items={founderBullets} />

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("expectTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("expectSimple")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("expectBody1")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("expectBody2")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("expectBody3")}</p>

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("howTitle")}</h2>
        <ol className="mt-3 space-y-2 text-sm font-light leading-relaxed text-gray-300/95">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="shrink-0 font-medium text-white/60">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <Divider />

        <h2 className="text-sm font-medium uppercase tracking-wider text-white/90">{t("costTitle")}</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-300/95">{t("costFree")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("costNoInstall")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("costNoSub")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("costNoCommit")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("costGoal")}</p>

        <Divider />

        <p className="text-sm font-light leading-relaxed text-gray-300/95">{t("closing1")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("closing2")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("closing3")}</p>
        <p className="mt-2 text-sm font-light leading-relaxed text-gray-400">{t("closing4")}</p>
        <p className="mt-4 pb-2 text-sm font-light leading-relaxed text-white/80">{t("closingCta")}</p>
      </div>

      <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
        <HomeLandingCta className="mt-0 w-full max-w-none" onClick={onAcknowledge}>
          {t("acknowledgeCta")}
        </HomeLandingCta>
      </div>
    </div>
  );
}
