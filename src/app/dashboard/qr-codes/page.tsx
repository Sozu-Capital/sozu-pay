"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { PaymentLinkQrDownload } from "@/components/PaymentLinkQrDownload";
import { ProductImageField } from "@/components/ProductImageField";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { qrPointScanUrl } from "@/lib/dashboard/merchant-qr";
import type { QrPointDestinationType } from "@/lib/dashboard/merchant-qr";
import { normalizeEditionSize } from "@/lib/dashboard/collectible-edition";
import {
  formatPaymentLinkPrice,
  paymentLinkStoreLabel,
} from "@/lib/dashboard/payment-link-card";
import { parseStandingLink, parseStandingPriceUsd, slugFromTitle } from "@/lib/dashboard/payment-link";

type QRPoint = {
  id: string;
  name: string;
  slug: string;
  pointType: "qr" | "nfc";
  destinationType: QrPointDestinationType;
  destinationRef: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  createdAt: string;
};

export default function QRCodesPage() {
  const t = useTranslations("qrNfcPage");
  const profile = useDashboardProfile();
  const [qrPoints, setQRPoints] = useState<QRPoint[]>([]);
  const [storeSlug, setStoreSlug] = useState("");
  const [openPointId, setOpenPointId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const pendingScrollId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [productKind, setProductKind] = useState<"product" | "drink">("product");
  const [collectibleOn, setCollectibleOn] = useState(true);
  const [editionSize, setEditionSize] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/merchant/qr-points")
      .then((r) => (r.ok ? r.json() : { qrPoints: [] }))
      .then((d) => {
        setQRPoints(d.qrPoints ?? []);
        setStoreSlug(typeof d.storeSlug === "string" ? d.storeSlug : "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = pendingScrollId.current;
    if (!id || loading) return;
    pendingScrollId.current = null;
    document.getElementById(`payment-link-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, qrPoints]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    if (!amount.trim() || Number(amount.replace(",", ".")) <= 0) {
      setError(t("errorAmount"));
      return;
    }
    const collectibleReceipt = productKind === "product" && collectibleOn;
    const edition = collectibleReceipt ? normalizeEditionSize(editionSize) : null;
    if (collectibleReceipt && editionSize.trim() && edition == null) {
      setError(t("errorEdition"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/merchant/qr-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amountUsd: amount.trim().replace(",", "."),
          productKind,
          collectibleReceipt,
          editionSize: edition,
          imageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("errorCreateFailed"));
        return;
      }
      const createdId = typeof data.qrPoint?.id === "string" ? data.qrPoint.id : null;
      setName("");
      setAmount("");
      setProductKind("product");
      setCollectibleOn(true);
      setEditionSize("");
      setImageUrl(null);
      setShowForm(false);
      if (createdId) {
        setOpenPointId(createdId);
        setFreshId(createdId);
        pendingScrollId.current = createdId;
      }
      load();
    } finally {
      setBusy(false);
    }
  };

  const savePointImage = async (id: string, next: string | null) => {
    const res = await fetch(`/api/merchant/qr-points/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return (data.error as string) ?? t("imageSaveFailed");
    setQRPoints((points) =>
      points.map((point) => (point.id === id ? { ...point, imageUrl: next } : point)),
    );
    return null;
  };

  const handleToggleOnline = async (id: string, currentOnline: boolean) => {
    try {
      await fetch(`/api/merchant/qr-points/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: !currentOnline }),
      });
      load();
    } catch (err) {
      console.error("Failed to toggle online status:", err);
    }
  };

  const handleDelete = async (id: string, pointName: string) => {
    if (!confirm(t("confirmDelete", { name: pointName }))) return;
    try {
      const res = await fetch(`/api/merchant/qr-points/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (openPointId === id) setOpenPointId(null);
        load();
      }
    } catch (err) {
      console.error("Failed to delete point:", err);
    }
  };

  const getPointUrl = (qr: QRPoint) =>
    storeSlug
      ? qrPointScanUrl({ ...qr, storeSlug }, baseUrl)
      : `${baseUrl.replace(/\/$/, "")}/pay/qr/${qr.slug}`;

  const storeLabel = paymentLinkStoreLabel(profile?.profile?.org_name, storeSlug);

  const qrDownloadLabels = {
    downloadLabel: t("downloadQr"),
    hint: t("downloadQrHint"),
    downloadedLabel: t("downloaded"),
    copyLabel: t("copyUrl"),
    copiedLabel: t("copiedUrl"),
    shareLabel: t("shareLink"),
    sharedLabel: t("shared"),
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
          >
            {t("newPoint")}
          </button>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-200">
        {t("dynamicHint")}
      </p>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white">{t("formTitle")}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("amountLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">USD</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder={t("amountPlaceholder")}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("amountHint")}</p>
          </div>

          <ProductImageField imageUrl={imageUrl} disabled={busy} onChange={(next) => setImageUrl(next)} />

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("productKindLabel")}
            </legend>
            <div className="flex gap-2">
              {(["product", "drink"] as const).map((kind) => {
                const selected = productKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setProductKind(kind)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                    }`}
                    aria-pressed={selected}
                  >
                    {kind === "drink" ? t("productKindDrink") : t("productKindProduct")}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className={`flex items-start gap-3 text-sm ${productKind === "drink" ? "opacity-60" : ""}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={productKind === "product" && collectibleOn}
              disabled={productKind === "drink"}
              onChange={(e) => setCollectibleOn(e.target.checked)}
            />
            <span>
              <span className="font-medium text-gray-900 dark:text-white">{t("collectibleToggle")}</span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t("collectibleHint")}</span>
            </span>
          </label>

          {productKind === "product" && collectibleOn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("editionLabel")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={editionSize}
                onChange={(e) => setEditionSize(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={t("editionPlaceholder")}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("editionHint")}</p>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("slugPreview", {
              slug: `${storeSlug ? `${storeSlug}/` : ""}${slugFromTitle(name || t("namePlaceholder"))}`,
            })}
          </p>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 text-sm"
            >
              {busy ? t("creating") : t("createButton")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setName("");
                setAmount("");
                setProductKind("product");
                setCollectibleOn(true);
                setEditionSize("");
                setImageUrl(null);
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("listTitle")}</h2>
        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : qrPoints.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {qrPoints.map((qr) => {
              const isOpen = openPointId === qr.id;
              return (
              <div
                key={qr.id}
                id={`payment-link-${qr.id}`}
                className={`rounded-lg border bg-white dark:bg-gray-800/50 p-4 ${
                  isOpen
                    ? "border-indigo-400 dark:border-indigo-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setOpenPointId(isOpen ? null : qr.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-start text-left rounded-md -m-1 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                >
                  {qr.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr.imageUrl}
                      alt=""
                      className="mr-3 h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{qr.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          qr.pointType === "nfc"
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                            : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                        }`}
                      >
                        {qr.pointType === "nfc" ? t("badgeNfc") : t("badgeQr")}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          qr.isOnline
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {qr.isOnline ? t("online") : t("offline")}
                      </span>
                      {(() => {
                        const offer = parseStandingLink(qr.destinationRef);
                        if (!offer) return null;
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              {offer.productKind === "drink"
                                ? t("drinkBadge")
                                : offer.collectibleReceipt
                                  ? t("collectibleBadge")
                                  : t("productKindProduct")}
                            </span>
                            {offer.editionSize ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                                {t("editionBadge", { size: offer.editionSize })}
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                    <p className="mt-1 text-sm text-gray-400 break-all font-mono">{getPointUrl(qr)}</p>
                    {(() => {
                      const price = parseStandingPriceUsd(qr.destinationRef);
                      const status = price
                        ? t("reusablePrice", { amount: price })
                        : qr.destinationType === "custom_url"
                          ? t("customUrlLinked", { url: qr.destinationRef ?? "" })
                          : qr.destinationType === "checkout"
                            ? qr.destinationRef
                              ? t("liveCheckoutLinked", { id: qr.destinationRef })
                              : t("liveCheckoutWaiting")
                            : null;
                      if (!status) return null;
                      return <p className="text-xs text-gray-400 mt-1">{status}</p>;
                    })()}
                  </div>
                </button>
                {qr.pointType === "qr" && (
                  <PaymentLinkQrDownload
                    variant="thumb"
                    payUrl={getPointUrl(qr)}
                    item={qr.name}
                    store={storeLabel}
                    price={formatPaymentLinkPrice(parseStandingPriceUsd(qr.destinationRef))}
                    {...qrDownloadLabels}
                  />
                )}
                </div>
                {isOpen && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                    <ProductImageField
                      imageUrl={qr.imageUrl}
                      onChange={(next) => savePointImage(qr.id, next)}
                    />
                    {freshId === qr.id && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("createdReady")}</p>
                    )}
                    {qr.pointType === "qr" && (
                      <PaymentLinkQrDownload
                        variant="card"
                        payUrl={getPointUrl(qr)}
                        item={qr.name}
                        store={storeLabel}
                        price={formatPaymentLinkPrice(parseStandingPriceUsd(qr.destinationRef))}
                        {...qrDownloadLabels}
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getPointUrl(qr)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm font-medium"
                      >
                        {t("openPayUrl")}
                      </a>
                      <button
                        type="button"
                        onClick={() => setOpenPointId(null)}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {t("closePoint")}
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleOnline(qr.id, qr.isOnline)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {qr.isOnline ? t("takeOffline") : t("bringOnline")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(qr.id, qr.name)}
                    className="rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
