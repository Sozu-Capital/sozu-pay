"use client";

import { useTranslations } from "next-intl";

export type OrgKind = "store" | "ngo";

type OrgKindPickerProps = {
  onSelect: (kind: OrgKind) => void;
};

export function OrgKindPicker({ onSelect }: OrgKindPickerProps) {
  const t = useTranslations("onboardingPages.createOrg");

  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur-sm">
      <h1 className="text-xl font-semibold text-white">{t("typePickerTitle")}</h1>
      <p className="mt-2 text-sm text-gray-300">{t("typePickerSubtitle")}</p>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => onSelect("store")}
          className="rounded-lg border border-white/15 bg-white/5 p-4 text-left transition-colors hover:border-white/30 hover:bg-white/10"
        >
          <p className="text-sm font-semibold text-white">{t("typeStoreTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("typeStoreBody")}</p>
        </button>
        <button
          type="button"
          onClick={() => onSelect("ngo")}
          className="rounded-lg border border-white/15 bg-white/5 p-4 text-left transition-colors hover:border-white/30 hover:bg-white/10"
        >
          <p className="text-sm font-semibold text-white">{t("typeDistTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("typeDistBody")}</p>
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">{t("typeOneShotHint")}</p>
    </div>
  );
}
