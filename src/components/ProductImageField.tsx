"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { PRODUCT_IMAGE_DATA_URL_MAX_LENGTH } from "@/lib/dashboard/product-image";
import { fileToProductImageDataUrl } from "@/lib/dashboard/product-image-file";

export function ProductImageField({
  imageUrl,
  disabled = false,
  onChange,
}: {
  imageUrl: string | null;
  disabled?: boolean;
  /** Return an error message when the save fails. */
  onChange: (next: string | null) => Promise<string | null | void> | string | null | void;
}) {
  const t = useTranslations("qrNfcPage");
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: string | null) {
    setError(null);
    setBusy(true);
    try {
      const message = await onChange(next);
      if (typeof message === "string" && message) setError(message);
    } catch {
      setError(t("imageSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("imageInvalid"));
      return;
    }
    try {
      const dataUrl = await fileToProductImageDataUrl(file);
      if (dataUrl.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
        setError(t("imageTooLarge"));
        return;
      }
      await apply(dataUrl);
    } catch {
      setError(t("imageInvalid"));
    }
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("imageLabel")}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-gray-400">{t("imageEmpty")}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className={`rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium ${
              disabled || busy
                ? "opacity-50"
                : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {imageUrl ? t("imageChange") : t("imageAdd")}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onFile(file);
            }}
          />
          {imageUrl ? (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void apply(null)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {t("imageRemove")}
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("imageHint")}</p>
      {error ? <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
