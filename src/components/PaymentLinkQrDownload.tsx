"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  paintPaymentLinkCard,
  paymentLinkCardFilename,
  paymentLinkShareText,
  PAYMENT_LINK_CARD,
  type PaymentLinkCardCopy,
} from "@/lib/dashboard/payment-link-card";

type PaymentLinkQrDownloadProps = {
  payUrl: string;
  item: string;
  store: string;
  price: string | null;
  variant: "thumb" | "card";
  downloadLabel: string;
  hint: string;
  downloadedLabel: string;
  copyLabel?: string;
  copiedLabel?: string;
  shareLabel?: string;
  sharedLabel?: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rasterizeQrSvg(svg: SVGSVGElement, size: number): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("qr"));
    };
    image.src = url;
  });
}

async function renderCardBlob(svg: SVGSVGElement, copy: PaymentLinkCardCopy): Promise<Blob | null> {
  const qr = await rasterizeQrSvg(svg, PAYMENT_LINK_CARD.qrSize);
  const card = document.createElement("canvas");
  card.width = PAYMENT_LINK_CARD.width;
  card.height = PAYMENT_LINK_CARD.height;
  const ctx = card.getContext("2d");
  if (!ctx) return null;
  paintPaymentLinkCard(ctx, qr, copy);
  return new Promise((resolve) => card.toBlob(resolve, "image/png"));
}

export function PaymentLinkQrDownload({
  payUrl,
  item,
  store,
  price,
  variant,
  downloadLabel,
  hint,
  downloadedLabel,
  copyLabel,
  copiedLabel,
  shareLabel,
  sharedLabel,
}: PaymentLinkQrDownloadProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy: PaymentLinkCardCopy = { item, store, price, url: payUrl };
  const displaySize = variant === "thumb" ? 80 : 220;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2000);
  }

  async function downloadCard(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const blob = await renderCardBlob(svg, copy);
      if (!blob) return;
      downloadBlob(blob, paymentLinkCardFilename(item));
      flash(downloadedLabel);
    } catch {
      setNotice(null);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(payUrl);
      flash(copiedLabel ?? downloadLabel);
    } catch {
      setNotice(null);
    }
  }

  async function shareCard() {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const blob = await renderCardBlob(svg, copy);
      if (!blob) return;
      const file = new File([blob], paymentLinkCardFilename(item), { type: "image/png" });
      const text = paymentLinkShareText(copy);
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: item, text });
        flash(sharedLabel ?? downloadLabel);
        return;
      }
      downloadBlob(blob, file.name);
      try {
        await navigator.clipboard.writeText(payUrl);
      } catch {
        // The PNG still downloaded.
      }
      flash(downloadedLabel);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNotice(null);
    }
  }

  const qr = (
    <QRCodeSVG
      ref={svgRef}
      value={payUrl}
      size={displaySize}
      bgColor="#FFFFFF"
      fgColor="#111827"
      level="M"
      marginSize={2}
      aria-hidden
    />
  );

  if (variant === "thumb") {
    return (
      <button
        type="button"
        onClick={downloadCard}
        aria-label={downloadLabel}
        title={notice ?? downloadLabel}
        className="shrink-0 rounded-xl border border-gray-200 bg-white p-1 shadow-sm hover:border-emerald-500 dark:border-gray-600"
      >
        {qr}
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xs rounded-[28px] border border-[#e5e7eb] bg-white px-6 pb-5 pt-6 text-center shadow-sm">
      <button
        type="button"
        onClick={downloadCard}
        aria-label={downloadLabel}
        className="mx-auto block rounded-2xl"
      >
        {qr}
      </button>
      <p className="mt-4 text-base font-semibold text-[#111827]">{item}</p>
      <p className="text-sm text-[#6b7280]">{store}</p>
      {price ? <p className="mt-1 text-lg font-bold text-[#111827]">{price}</p> : null}
      <p className="mt-2 break-all text-xs text-[#4b5563]">{payUrl}</p>
      <p className="mt-3 text-xs font-medium text-emerald-700">{notice ?? hint}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={copyUrl}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={shareCard}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {shareLabel}
        </button>
      </div>
    </div>
  );
}
