"use client";

import { useTranslations } from "next-intl";

type CheckoutPreviewCardProps = {
  amountUsd: string;
  reference?: string;
  allowDebit?: boolean;
  allowCredit?: boolean;
  allowBankTransfer?: boolean;
};

export function CheckoutPreviewCard({ 
  amountUsd, 
  reference,
  allowDebit = true,
  allowCredit = true,
  allowBankTransfer = true,
}: CheckoutPreviewCardProps) {
  const t = useTranslations("checkoutPage");
  
  const paymentMethods = [];
  if (allowDebit) paymentMethods.push("Debit card");
  if (allowCredit) paymentMethods.push("Credit card");
  if (allowBankTransfer) paymentMethods.push("Bank transfer");

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 text-center">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Preview
      </p>
      <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">SozuPay Checkout</h1>
      <p className="mt-4 text-3xl font-bold tabular-nums">${amountUsd}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">USD</p>
      {reference && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Ref: {reference}</p>
      )}
      
      {paymentMethods.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Payment methods
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {paymentMethods.map((method) => (
              <span 
                key={method}
                className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        Complete your payment to send funds directly to the merchant&apos;s account.
      </p>
    </div>
  );
}
