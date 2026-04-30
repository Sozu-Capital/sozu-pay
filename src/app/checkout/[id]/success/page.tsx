type Props = { params: Promise<{ id: string }> };

export default async function CheckoutSuccessPage({ params }: Props) {
  await params; // consume param to satisfy Next.js typing
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">Payment received!</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your payment is being processed. Funds will arrive in the merchant&apos;s account shortly.
        </p>
      </div>
    </main>
  );
}
