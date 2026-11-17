import { parseProductImageDataUrl } from "@/lib/dashboard/product-image";
import { slugFromTitle } from "@/lib/dashboard/payment-link";

export type SouvenirLaunchInput = {
  title: string;
  imageUrl: string;
  claimStartsAt: string;
  claimEndsAt: string;
  merchantOrgId: string;
  merchantName: string;
};

export type LaunchedSouvenir = {
  slug: string;
  name: string;
  drop: string;
  imagePath: string;
  claimStartsAt: string;
  claimEndsAt: string;
};

export function parseSouvenirLaunch(body: unknown): SouvenirLaunchInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const row = body as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (title.length < 1 || title.length > 80) return { error: "invalid_title" };
  let imageUrl: string;
  try {
    const parsed = parseProductImageDataUrl(row.imageUrl);
    if (!parsed) return { error: "invalid_image" };
    imageUrl = parsed;
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid_image";
    return { error: code === "PRODUCT_IMAGE_TOO_LARGE" ? code : "invalid_image" };
  }
  const start = Date.parse(typeof row.claimStartsAt === "string" ? row.claimStartsAt : "");
  const end = Date.parse(typeof row.claimEndsAt === "string" ? row.claimEndsAt : "");
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return { error: "invalid_window" };
  const merchantOrgId = typeof row.merchantOrgId === "string" ? row.merchantOrgId.trim() : "";
  if (!merchantOrgId) return { error: "invalid_org" };
  const merchantName =
    typeof row.merchantName === "string" && row.merchantName.trim()
      ? row.merchantName.trim().slice(0, 120)
      : title;
  return {
    title,
    imageUrl,
    claimStartsAt: new Date(start).toISOString(),
    claimEndsAt: new Date(end).toISOString(),
    merchantOrgId,
    merchantName,
  };
}

export function souvenirSlug(title: string, unique: string): string {
  const root = slugFromTitle(title);
  const suffix = unique.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "drop";
  return `${root === "link" ? "souvenir" : root}-${suffix}`.slice(0, 80);
}

export function walletSouvenirOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SOZU_WALLET_URL?.replace(/\/$/, "") ||
    process.env.SOZUCREDIT_URL?.replace(/\/$/, "") ||
    "https://dev.sozu.capital"
  );
}

export function souvenirLaunchHeaders(): Record<string, string> {
  const secret = process.env.SOZU_PAY_SOUVENIR_SECRET?.trim() ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret.length >= 16) headers["x-sozu-pay-souvenir"] = secret;
  return headers;
}

export function launchedFromUnknown(raw: unknown): LaunchedSouvenir | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== "string" || typeof row.name !== "string") return null;
  if (typeof row.imagePath !== "string") return null;
  return {
    slug: row.slug,
    name: row.name,
    drop: typeof row.drop === "string" ? row.drop : "",
    imagePath: row.imagePath,
    claimStartsAt: typeof row.claimStartsAt === "string" ? row.claimStartsAt : "",
    claimEndsAt: typeof row.claimEndsAt === "string" ? row.claimEndsAt : "",
  };
}
