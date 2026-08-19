/** Printed/displayed QR & NFC encode the stable pay URL, not a one-shot checkout id. */

export const QR_POINT_DESTINATION_TYPES = ["checkout", "custom_url", "pizza_sku"] as const;
export type QrPointDestinationType = (typeof QR_POINT_DESTINATION_TYPES)[number];

export type QrPointScanTarget = {
  slug: string;
  destinationType: QrPointDestinationType;
  destinationRef: string | null;
};

export function parseQrPointDestinationType(raw: unknown): QrPointDestinationType | null {
  if (raw === "checkout" || raw === "custom_url" || raw === "pizza_sku") return raw;
  return null;
}

export function qrPointScanUrl(point: QrPointScanTarget, baseUrl: string): string {
  if (point.destinationType === "custom_url" && point.destinationRef) {
    return point.destinationRef;
  }
  return `${baseUrl.replace(/\/$/, "")}/pay/qr/${point.slug}`;
}

/** Pizza SKU never stores a checkout session id. Live checkout may attach the latest pending one. */
export function destinationRefForQrCreate(params: {
  destinationType: QrPointDestinationType;
  destinationRef?: string;
  latestCheckoutId?: string | null;
}): string | undefined {
  if (params.destinationType === "pizza_sku") return undefined;
  if (params.destinationType === "custom_url") {
    return params.destinationRef || undefined;
  }
  return params.destinationRef || params.latestCheckoutId || undefined;
}

export type PayQrRoute =
  | { kind: "offline"; name: string }
  | { kind: "custom_url"; url: string }
  | { kind: "pizza_sku"; name: string; slug: string }
  | { kind: "needs_live_checkout"; orgId: string; destinationRef: string | null; name: string };

export function routePayQrPoint(qr: {
  name: string;
  slug: string;
  orgId: string;
  isOnline: boolean;
  destinationType: QrPointDestinationType;
  destinationRef: string | null;
}): PayQrRoute {
  if (!qr.isOnline) return { kind: "offline", name: qr.name };
  if (qr.destinationType === "custom_url" && qr.destinationRef) {
    return { kind: "custom_url", url: qr.destinationRef };
  }
  if (qr.destinationType === "pizza_sku") {
    return { kind: "pizza_sku", name: qr.name, slug: qr.slug };
  }
  return {
    kind: "needs_live_checkout",
    orgId: qr.orgId,
    destinationRef: qr.destinationRef,
    name: qr.name,
  };
}
