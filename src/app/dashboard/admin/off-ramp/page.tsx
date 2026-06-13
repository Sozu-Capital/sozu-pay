import Link from "next/link";

const ADMIN_OFF_RAMP_URL =
  process.env.NEXT_PUBLIC_SOZU_ADMIN_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

/** Legacy route — merchant off-ramp ops live on SozuAdmin. */
export default function OffRampRedirectPage() {
  const target = `${ADMIN_OFF_RAMP_URL}/dashboard/settlements/off-ramp`;

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Off-ramp queue moved</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Merchant bank withdrawals are fulfilled in the SozuAdmin dashboard (Settlement Center →
        off-ramp queue), not in SozuPay.
      </p>
      <Link
        href={target}
        className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
      >
        Open SozuAdmin off-ramp queue →
      </Link>
    </div>
  );
}
