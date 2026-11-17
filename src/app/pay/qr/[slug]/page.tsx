import { redirect } from "next/navigation";
import { payQrNotFound } from "@/app/pay/qr/render-pay-qr-point";
import { paymentLinkPath } from "@/lib/dashboard/payment-link";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { ensureOrganizationSlug, getOrganizationById } from "@/lib/db/organizations";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    intent?: string;
    hopped?: string;
    pizza?: string;
    guest?: string;
  }>;
};

function querySuffix(sp: {
  intent?: string;
  hopped?: string;
  pizza?: string;
  guest?: string;
}): string {
  const qs = new URLSearchParams();
  for (const key of ["intent", "hopped", "pizza", "guest"] as const) {
    const value = sp[key];
    if (value) qs.set(key, value);
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
}

/** Old single-name links keep working and land on /pay/qr/{store}/{item}. */
export default async function PayQRPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const qr = await getQRPointBySlug(slug);
  if (!qr) return payQrNotFound();

  const org = await getOrganizationById(qr.orgId);
  const store = org ? await ensureOrganizationSlug(org) : qr.orgId;
  const path = paymentLinkPath(store, qr.slug);
  if (!path) return payQrNotFound();

  const sp = await searchParams;
  redirect(`${path}${querySuffix(sp)}`);
}
