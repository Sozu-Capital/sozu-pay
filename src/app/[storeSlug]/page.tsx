import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { findOrgByStoreSlug } from "@/lib/db/store-slugs";
import { listStandingCheckoutsForOrg } from "@/lib/db/standing-checkouts";
import {
  effectiveStandingCheckoutState,
  namedCheckoutPath,
  normalizePublicSlug,
  storeLandingDestination,
} from "@/lib/named-checkout";

type Props = { params: Promise<{ storeSlug: string }> };

export default async function StoreLandingPage({ params }: Props) {
  const raw = (await params).storeSlug;
  const storeSlug = normalizePublicSlug(raw);
  if (!storeSlug) notFound();

  const match = await findOrgByStoreSlug(storeSlug);
  if (!match) notFound();

  const dest = storeLandingDestination({
    storeKnown: true,
    requestedSlug: storeSlug,
    currentSlug: match.currentSlug,
  });
  if (dest.kind === "not-found") notFound();
  if (dest.kind === "redirect") redirect(dest.redirect);

  const rows = await listStandingCheckoutsForOrg(match.org.id);
  const live = rows.filter(
    (row) =>
      effectiveStandingCheckoutState({
        live: row.live,
        deadlineAt: row.deadline_at,
      }) === "live",
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs uppercase tracking-wide text-gray-400">Store</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {match.org.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">/{match.currentSlug}</p>
        {live.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            No live offers right now.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {live.map((row) => (
              <li key={row.id}>
                <Link
                  href={namedCheckoutPath(match.currentSlug, row.checkout_slug)}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {row.checkout_slug}
                  </span>
                  <span className="text-gray-500">${row.amount_usd}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
