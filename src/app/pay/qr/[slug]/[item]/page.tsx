import { payQrNotFound, renderPayQrPoint } from "@/app/pay/qr/render-pay-qr-point";
import { isOrganizationId, parseStorePathSegment } from "@/lib/dashboard/payment-link";
import { getQRPointByOrgAndSlug } from "@/lib/db/merchant-qr-points";
import { getOrganizationById, getOrganizationBySlug } from "@/lib/db/organizations";

/**
 * /pay/qr/{store}/{item}. The store segment is named `slug` because the older
 * /pay/qr/{slug} route already uses that name, and Next refuses two different
 * names in the same slot.
 */
type Props = {
  params: Promise<{ slug: string; item: string }>;
  searchParams: Promise<{
    intent?: string;
    hopped?: string;
    pizza?: string;
    guest?: string;
  }>;
};

export default async function PayStoreQrPage({ params, searchParams }: Props) {
  const { slug: rawStore, item: rawItem } = await params;
  const store = parseStorePathSegment(rawStore);
  const item = rawItem.trim().toLowerCase();
  if (!store || !/^[a-z0-9_-]+$/.test(item)) return payQrNotFound();

  const org = isOrganizationId(store)
    ? await getOrganizationById(store)
    : await getOrganizationBySlug(store);
  if (!org) return payQrNotFound();

  const qr = await getQRPointByOrgAndSlug(org.id, item);
  if (!qr) return payQrNotFound();

  return renderPayQrPoint(qr, store, searchParams);
}
