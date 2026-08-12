"use client";

import { QRCodeSVG } from "qrcode.react";

type LocalQrCodeProps = {
  value: string;
  size?: number;
  alt: string;
  className?: string;
};

/** Client QR encoder — SVG in-process, no third-party image CDN. */
export function LocalQrCode({ value, size = 220, alt, className }: LocalQrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="#FFFFFF"
      fgColor="#111827"
      level="M"
      role="img"
      aria-label={alt}
      className={className}
    />
  );
}
