import Link from "next/link";
import { redirect } from "next/navigation";
import MargheritaSkuPage from "@/components/pizza/MargheritaSkuPage";
import { PizzaAutoRedeem } from "@/components/pizza/PizzaAutoRedeem";
import {
  PizzaClaimedConfirmation,
  PizzaRedeemPoller,
} from "@/components/pizza/PizzaRedeemStatus";
import {
  getCheckoutSession,
  getLatestPendingCheckoutForOrg,
} from "@/lib/db/checkout-sessions";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { getPizzaRedeem } from "@/lib/db/pizza-redeems";
import { checkoutSessionUrl, merchantQrPayUrl } from "@/lib/checkout-url";
import { routePayQrPoint } from "@/lib/dashboard/merchant-qr";
import { getWalletOrigin, nextPizzaSkuGuestAction } from "@/lib/pizza/redeem";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    intent?: string;
    hopped?: string;
    pizza?: string;
    guest?: string;
  }>;
};

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

export default async function PayQRPage({ params, searchParams }: Props) {
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

  const route = routePayQrPoint(qr);

  if (route.kind === "offline") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment point offline</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {route.name} is not accepting payments right now. Ask the merchant to bring this point online.
          </p>
        </div>
      </main>
    );
  }

  if (route.kind === "custom_url") {
    redirect(route.url);
  }

  if (route.kind === "pizza_sku") {
    const sp = await searchParams;
    const walletOrigin = getWalletOrigin();
    const next = nextPizzaSkuGuestAction(
      {
        intent: sp.intent,
        hopped: sp.hopped,
        pizza: sp.pizza,
        guest: sp.guest,
      },
      { payUrl: merchantQrPayUrl(slug), walletOrigin },
    );

    if (next.kind === "intent") {
      const redeem = await getPizzaRedeem(next.intentId);
      if (redeem && redeem.qrPointId === qr.id && redeem.status === "submitted") {
        return <PizzaClaimedConfirmation pointName={route.name} walletOrigin={walletOrigin} />;
      }
      if (redeem && redeem.qrPointId === qr.id) {
        return (
          <PizzaRedeemPoller
            intentId={next.intentId}
            pointName={route.name}
            walletOrigin={walletOrigin}
          />
        );
      }
      return <MargheritaSkuPage pointName={route.name} />;
    }

    if (next.kind === "hop") {
      redirect(next.url);
    }

    if (next.kind === "auto_redeem") {
      return <PizzaAutoRedeem slug={slug} guestAddress={next.guestAddress} />;
    }

    return <MargheritaSkuPage pointName={route.name} />;
  }

  const checkoutId = await resolveLiveCheckoutId(route.orgId, route.destinationRef);

  if (!checkoutId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">No active payment</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {route.name} is ready, but the merchant has not opened a live checkout yet. Scan again once they create a payment link.
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

  redirect(checkoutSessionUrl(checkoutId));
}
