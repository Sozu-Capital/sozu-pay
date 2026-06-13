import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCheckoutSession,
  getLatestPendingCheckoutForOrg,
} from "@/lib/db/checkout-sessions";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";

type Props = { params: Promise<{ slug: string }> };

async function resolveLiveCheckoutId(
  orgId: string,
  destinationRef: string | null,
): Promise<string | null> {
  if (destinationRef) {
    const session = await getCheckoutSession(destinationRef);
    if (
      session &&
      session.org_id === orgId &&
      session.status === "pending" &&
      !session.deleted_at
    ) {
      return session.id;
    }
  }
  const latest = await getLatestPendingCheckoutForOrg(orgId);
  return latest?.id ?? null;
}

export default async function PayQRPage({ params }: Props) {
  const { slug } = await params;
  const qr = await getQRPointBySlug(slug);

  if (!qr) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment point not found</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This QR or NFC link is invalid or has been removed.
          </p>
        </div>
      </main>
    );
  }

  if (!qr.isOnline) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment point offline</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {qr.name} is not accepting payments right now. Ask the merchant to bring this point online.
          </p>
        </div>
      </main>
    );
  }

  if (qr.destinationType === "custom_url" && qr.destinationRef) {
    redirect(qr.destinationRef);
  }

  const checkoutId = await resolveLiveCheckoutId(qr.orgId, qr.destinationRef);

  if (!checkoutId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">No active payment</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {qr.name} is ready, but the merchant has not opened a live checkout yet. Scan again once they create a payment link.
          </p>
          <Link
            href="/merchants"
            className="mt-6 inline-block rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2 text-sm font-medium"
          >
            Learn about SOZU
          </Link>
        </div>
      </main>
    );
  }

  redirect(`/checkout/${checkoutId}`);
}
