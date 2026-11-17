export default function MargheritaSkuPage({ pointName }: { pointName: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Standing pizza SKU
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Margherita</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{pointName}</p>
        <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">1 PIZZA</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Redeem one pizza credit.
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            disabled
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 cursor-not-allowed"
          >
            Credit / debit
          </button>
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Sozu
          </button>
        </div>
      </div>
    </main>
  );
}
