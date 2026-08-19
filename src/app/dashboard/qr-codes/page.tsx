"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { qrPointScanUrl } from "@/lib/dashboard/merchant-qr";
import type { QrPointDestinationType } from "@/lib/dashboard/merchant-qr";

type QRPoint = {
  id: string;
  name: string;
  slug: string;
  pointType: "qr" | "nfc";
  destinationType: QrPointDestinationType;
  destinationRef: string | null;
  isOnline: boolean;
  createdAt: string;
};

export default function QRCodesPage() {
  const t = useTranslations("qrNfcPage");
  const [qrPoints, setQRPoints] = useState<QRPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pointType, setPointType] = useState<"qr" | "nfc">("qr");
  const [destinationType, setDestinationType] = useState<QrPointDestinationType>("checkout");
  const [destinationRef, setDestinationRef] = useState("");
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
      .then((d) => setQRPoints(d.qrPoints ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    if (!slug.trim()) {
      setError(t("errorSlugRequired"));
      return;
    }
    if (destinationType === "custom_url" && !destinationRef.trim()) {
      setError(t("errorUrlRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/merchant/qr-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          pointType,
          destinationType,
          destinationRef:
            destinationType === "pizza_sku" ? undefined : destinationRef.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("errorCreateFailed"));
        return;
      }
      setName("");
      setSlug("");
      setPointType("qr");
      setDestinationType("checkout");
      setDestinationRef("");
      setShowForm(false);
      load();
    } finally {
      setBusy(false);
    }
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
      if (res.ok) load();
    } catch (err) {
      console.error("Failed to delete point:", err);
    }
  };

  const getPointUrl = (qr: QRPoint) => qrPointScanUrl(qr, baseUrl);

  const getQRImageUrl = (qr: QRPoint) => {
    const payUrl = getPointUrl(qr);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payUrl)}`;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
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
              {t("slugLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">/pay/qr/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder={t("slugPlaceholder")}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("slugHint")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("channelLabel")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={pointType === "qr"}
                  onChange={() => setPointType("qr")}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{t("channelQr")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={pointType === "nfc"}
                  onChange={() => setPointType("nfc")}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{t("channelNfc")}</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("channelHint")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("destinationLabel")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={destinationType === "checkout"}
                  onChange={() => setDestinationType("checkout")}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{t("destinationLiveCheckout")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={destinationType === "custom_url"}
                  onChange={() => setDestinationType("custom_url")}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{t("destinationCustomUrl")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={destinationType === "pizza_sku"}
                  onChange={() => setDestinationType("pizza_sku")}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{t("destinationPizzaSku")}</span>
              </label>
            </div>
          </div>

          {destinationType === "custom_url" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("urlLabel")}
              </label>
              <input
                type="url"
                value={destinationRef}
                onChange={(e) => setDestinationRef(e.target.value)}
                placeholder="https://example.com/checkout"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          )}

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
                setSlug("");
                setDestinationRef("");
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
            {qrPoints.map((qr) => (
              <div
                key={qr.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
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
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-all font-mono">
                      {getPointUrl(qr)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {qr.destinationType === "checkout"
                        ? qr.destinationRef
                          ? t("liveCheckoutLinked", { id: qr.destinationRef })
                          : t("liveCheckoutWaiting")
                        : qr.destinationType === "pizza_sku"
                          ? t("pizzaSkuLinked")
                          : t("customUrlLinked", { url: qr.destinationRef ?? "" })}
                    </p>
                  </div>
                  {qr.pointType === "qr" && (
                    <img
                      src={getQRImageUrl(qr)}
                      alt=""
                      className="w-20 h-20 rounded border border-gray-200 dark:border-gray-700 shrink-0"
                    />
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleOnline(qr.id, qr.isOnline)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {qr.isOnline ? t("takeOffline") : t("bringOnline")}
                  </button>
                  <button
                    onClick={() => handleDelete(qr.id, qr.name)}
                    className="rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
