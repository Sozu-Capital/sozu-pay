import { slugFromTitle } from "@/lib/dashboard/payment-link";

/** Share PNG: light page, rounded bordered card, QR above the offer. */
export const PAYMENT_LINK_CARD = {
  width: 1080,
  height: 1480,
  margin: 48,
  radius: 64,
  borderWidth: 6,
  padding: 72,
  qrSize: 680,
  blockGap: 48,
} as const;

export type PaymentLinkCardCopy = {
  item: string;
  store: string;
  price: string | null;
  url: string;
};

export function paymentLinkCardFilename(item: string): string {
  return `${slugFromTitle(item)}-qr.png`;
}

/** Store name on the card. Falls back to the store slug, then Sozu. */
export function paymentLinkStoreLabel(
  orgName: string | null | undefined,
  storeSlug: string,
): string {
  const name = orgName?.trim();
  if (name) return name;
  const slug = storeSlug.trim();
  if (slug) return slug;
  return "Sozu";
}

export function formatPaymentLinkPrice(amountUsd: string | null | undefined): string | null {
  if (!amountUsd) return null;
  return `$${amountUsd} USD`;
}

export function paymentLinkShareText(copy: PaymentLinkCardCopy): string {
  return [copy.item, copy.store, copy.price, copy.url]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

export function paymentLinkCardRegions() {
  const card = PAYMENT_LINK_CARD;
  const cardX = card.margin;
  const cardY = card.margin;
  const cardW = card.width - card.margin * 2;
  const cardH = card.height - card.margin * 2;
  const qrX = cardX + (cardW - card.qrSize) / 2;
  const qrY = cardY + card.padding;
  const textTop = qrY + card.qrSize + card.blockGap;
  const textBottom = cardY + cardH - card.padding;
  const textX = cardX + card.padding;
  const textWidth = cardW - card.padding * 2;
  return { cardX, cardY, cardW, cardH, qrX, qrY, qrSize: card.qrSize, textTop, textBottom, textX, textWidth };
}

/** Wrap to `maxLines`. The last line ends with an ellipsis when the rest does not fit. */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (sample: string) => number,
  maxLines: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed || maxLines < 1 || maxWidth <= 0) return [];
  const lines: string[] = [];
  let rest = trimmed;
  while (rest && lines.length < maxLines) {
    if (measure(rest) <= maxWidth) {
      lines.push(rest);
      break;
    }
    const last = lines.length === maxLines - 1;
    let fit = 0;
    let lo = 1;
    let hi = rest.length;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const prefix = rest.slice(0, mid);
      const candidate = last && mid < rest.length ? `${prefix}…` : prefix;
      if (measure(candidate) <= maxWidth) {
        fit = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (fit <= 0) {
      lines.push("…");
      break;
    }
    if (last) {
      lines.push(fit < rest.length ? `${rest.slice(0, fit)}…` : rest.slice(0, fit));
      break;
    }
    const chunk = rest.slice(0, fit);
    const space = chunk.lastIndexOf(" ");
    const cut = space > 0 ? space : fit;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Paint the share card. The QR image sits in the top slot; copy is centered below it. */
export function paintPaymentLinkCard(
  ctx: CanvasRenderingContext2D,
  qr: CanvasImageSource,
  copy: PaymentLinkCardCopy,
): void {
  const card = PAYMENT_LINK_CARD;
  const region = paymentLinkCardRegions();
  ctx.clearRect(0, 0, card.width, card.height);
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, card.width, card.height);

  ctx.save();
  ctx.shadowColor = "rgba(17, 24, 39, 0.12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, region.cardX, region.cardY, region.cardW, region.cardH, card.radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  roundRect(ctx, region.cardX, region.cardY, region.cardW, region.cardH, card.radius);
  ctx.lineWidth = card.borderWidth;
  ctx.strokeStyle = "#d1d5db";
  ctx.stroke();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, region.qrX, region.qrY, region.qrSize, region.qrSize);

  const centerX = card.width / 2;
  let y = region.textTop;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const measure = (sample: string) => ctx.measureText(sample).width;

  ctx.fillStyle = "#111827";
  ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
  for (const line of wrapText(copy.item, region.textWidth, measure, 2)) {
    ctx.fillText(line, centerX, y);
    y += 68;
  }

  y += 8;
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 36px ui-sans-serif, system-ui, sans-serif";
  for (const line of wrapText(copy.store, region.textWidth, measure, 2)) {
    ctx.fillText(line, centerX, y);
    y += 46;
  }

  if (copy.price) {
    y += 16;
    ctx.fillStyle = "#111827";
    ctx.font = "700 64px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(copy.price, centerX, y);
    y += 76;
  }

  y += 20;
  ctx.fillStyle = "#4b5563";
  ctx.font = "400 26px ui-sans-serif, system-ui, sans-serif";
  for (const line of wrapText(copy.url, region.textWidth, measure, 2)) {
    ctx.fillText(line, centerX, y);
    y += 36;
  }
}
