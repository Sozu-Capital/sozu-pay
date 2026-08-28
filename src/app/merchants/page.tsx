import { redirect } from "next/navigation";

/** Retired store door — one login at `/`. */
export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; fresh?: string }>;
}) {
  const params = await searchParams;
  const url = new URL("/", "http://local.invalid");
  if (params.returnTo) url.searchParams.set("returnTo", params.returnTo);
  if (params.fresh) url.searchParams.set("fresh", params.fresh);
  redirect(`${url.pathname}${url.search}`);
}
