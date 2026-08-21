import { notFound, redirect } from "next/navigation";
import { findOrgByStoreSlug } from "@/lib/db/store-slugs";
import { getStandingCheckoutBySlug } from "@/lib/db/standing-checkouts";
import { NamedCheckoutPayButton } from "@/components/NamedCheckoutPayButton";
import {
  namedCheckoutPayerDestination,
  normalizePublicSlug,
} from "@/lib/named-checkout";

type Props = { params: Promise<{ storeSlug: string; checkoutSlug: string }> };

export default async function NamedCheckoutPage({ params }: Props) {
  const { storeSlug: storeRaw, checkoutSlug: checkoutRaw } = await params;
  const storeSlug = normalizePublicSlug(storeRaw);
  const checkoutSlug = normalizePublicSlug(checkoutRaw);
  if (!storeSlug) notFound();

  const match = await findOrgByStoreSlug(storeSlug);
  if (!match) notFound();

  if (match.requestedIsPrevious) {
    redirect(`/${match.currentSlug}`);
  }

  if (!checkoutSlug) {
    redirect(`/${match.currentSlug}`);
  }

  const standing = await getStandingCheckoutBySlug(match.org.id, checkoutSlug);
  const dest = namedCheckoutPayerDestination({
    storeKnown: true,
    storeSlug: match.currentSlug,
    checkoutSlug,
    checkout: standing
      ? { live: standing.live, deadlineAt: standing.deadline_at }
      : null,
  });

  if (dest.kind === "not-found") notFound();
  if (dest.kind === "store-landing") redirect(dest.redirect);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-400">{match.org.name}</p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
          {checkoutSlug}
        </h1>
        <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
          ${standing?.amount_usd}
        </p>
        <p className="mt-1 text-sm text-gray-500">USD</p>
        <NamedCheckoutPayButton storeSlug={match.currentSlug} checkoutSlug={checkoutSlug} />
      </div>
    </main>
  );
}
