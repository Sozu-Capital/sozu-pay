/** POS right-panel QR: encode only the live pay URL for this charge. */
export function posPaymentQrValue(checkoutUrl: string): string {
  return checkoutUrl.trim();
}

/** Figma QR card face is ~256px; keep the encoded SVG slightly inset. */
export const POS_QR_CARD_SIZE_PX = 256;
export const POS_QR_CODE_SIZE_PX = 200;
