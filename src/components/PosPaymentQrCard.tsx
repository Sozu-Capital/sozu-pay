"use client";

import { LocalQrCode } from "@/components/LocalQrCode";
import {
  POS_QR_CARD_SIZE_PX,
  POS_QR_CODE_SIZE_PX,
  posPaymentQrValue,
} from "@/lib/dashboard/pos-qr";

type PosPaymentQrCardProps = {
  checkoutUrl: string;
  alt: string;
  caption: string;
};

/**
 * Figma POS QR card: ~256px rounded white face inside a soft gray panel + scan caption.
 * Uses LocalQrCode (in-process SVG) — never a public QR image CDN.
 */
export function PosPaymentQrCard({ checkoutUrl, alt, caption }: PosPaymentQrCardProps) {
  const value = posPaymentQrValue(checkoutUrl);
  return (
    <div className="w-full rounded-[48px] border border-[#f3f4f6] bg-[#f9fafb] px-8 pb-8 pt-10">
      <div
        className="mx-auto flex items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white shadow-lg"
        style={{ width: POS_QR_CARD_SIZE_PX, height: POS_QR_CARD_SIZE_PX }}
        data-testid="pos-payment-qr-card"
      >
        <LocalQrCode value={value} size={POS_QR_CODE_SIZE_PX} alt={alt} />
      </div>
      <p className="mt-4 text-center text-sm font-bold leading-5 text-[#6b7280]">{caption}</p>
    </div>
  );
}
