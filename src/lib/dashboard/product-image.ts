const PRODUCT_IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Keep a product photo small enough to store on the payment-link row. */
export const PRODUCT_IMAGE_DATA_URL_MAX_LENGTH = 180_000;

export function parseProductImageDataUrl(raw: unknown): string | null {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !PRODUCT_IMAGE_DATA_URL.test(raw)) {
    throw new Error("INVALID_PRODUCT_IMAGE");
  }
  if (raw.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
    throw new Error("PRODUCT_IMAGE_TOO_LARGE");
  }
  return raw;
}

export function readStoredProductImage(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("data:image/") ? value : null;
}

export function isMissingProductImageColumn(message: string): boolean {
  return /image_url/i.test(message);
}

/** Absolute URL for the photo stored on a payment link. */
export function paymentLinkImageUrl(origin: string, storeId: string, itemSlug: string): string | null {
  const store = storeId.trim();
  const item = itemSlug.trim().toLowerCase();
  const base = origin.trim().replace(/\/$/, "");
  if (!store || !item || !/^https?:\/\//.test(base)) return null;
  return `${base}/api/public/stores/${encodeURIComponent(store)}/items/${encodeURIComponent(item)}/image`;
}
