import { getCheckoutSession } from "@/lib/db/checkout-sessions";
import { redirect } from "next/navigation";
import Link from "next/link";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

export default async function CheckoutPage({ params }: Props) {
  const { id } = await params;

  const session = await getCheckoutSession(id).catch(() => null);

  // If session not found or has no provider URL, show a clean error (e.g. expired or invalid link)
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment link not found</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This link may have expired or been used already.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </main>
    );
  }

  if (session.status === "completed") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment complete</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your payment of <strong>${session.amount_usd}</strong> has been received.
          </p>
          {session.reference && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Ref: {session.reference}</p>
          )}
        </div>
      </main>
    );
  }

  // Redirect to the provider-hosted payment UI
  if (session.provider_url) {
    redirect(session.provider_url);
  }

  // Fallback: show payment summary if provider URL is missing (e.g. DB-only session)
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">SozuPay Checkout</h1>
        <p className="mt-4 text-3xl font-bold">${session.amount_usd}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">USD</p>
        {session.reference && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Ref: {session.reference}</p>
        )}
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          Complete your payment to send funds directly to the merchant&apos;s account.
        </p>
      </div>
    </main>
  );
}
