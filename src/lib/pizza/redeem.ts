import { pizzaAmountToI128 } from "@/lib/stellar/pizza-token";

export const PIZZA_REDEEM_AMOUNT = 1 as const;

export type Sep41TransferCall = {
  contractId: string;
  method: "transfer";
  from: string;
  to: string;
  amount: bigint;
};

/** Copy of the SAC transfer shape (token.call("transfer", from, to, amount)) with a token-id parameter. */
export function buildSep41TransferCall(params: {
  tokenId: string;
  from: string;
  to: string;
  amount: bigint;
}): Sep41TransferCall {
  return {
    contractId: params.tokenId,
    method: "transfer",
    from: params.from,
    to: params.to,
    amount: params.amount,
  };
}

export function buildPizzaRedeemTransfer(params: {
  pizzaTokenId: string;
  guestAddress: string;
  storeSettleTo: string;
}): Sep41TransferCall {
  return buildSep41TransferCall({
    tokenId: params.pizzaTokenId,
    from: params.guestAddress,
    to: params.storeSettleTo,
    amount: pizzaAmountToI128(PIZZA_REDEEM_AMOUNT),
  });
}

/** Pizza redeem is a standing SKU — it must never write checkout_sessions.status = completed. */
export function pizzaRedeemCompletesCheckoutSession(): false {
  return false;
}

export function pizzaRedeemWalletSignUrl(params: {
  walletOrigin: string;
  intentId: string;
  returnTo: string;
}): string {
  const origin = params.walletOrigin.replace(/\/$/, "");
  const url = new URL("/auth", origin);
  url.searchParams.set("intent", params.intentId);
  url.searchParams.set("return_to", params.returnTo);
  return url.toString();
}

/** Store-checkout UI on the wallet — never /auth auto-sign. */
export function pizzaWalletCheckoutUrl(params: {
  walletOrigin: string;
  slug: string;
}): string {
  const origin = params.walletOrigin.replace(/\/$/, "");
  const slug = encodeURIComponent(params.slug.trim().toLowerCase());
  return `${origin}/checkout/pizza/${slug}`;
}

export function getWalletOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SOZU_WALLET_URL?.replace(/\/$/, "") ||
    "https://app.sozu.capital"
  );
}

export type PizzaSkuSearch = {
  intent?: string;
  hopped?: string;
  pizza?: string;
  guest?: string;
};

export type PizzaSkuGuestNext =
  | { kind: "intent"; intentId: string }
  | { kind: "hop"; url: string };

/** Pay.sozu.capital never prompts passkey/PIN — hop to wallet store checkout. */
export function nextPizzaSkuGuestAction(
  search: PizzaSkuSearch,
  ctx: { slug: string; walletOrigin: string },
): PizzaSkuGuestNext {
  const intentId = search.intent?.trim();
  if (intentId) return { kind: "intent", intentId };
  return { kind: "hop", url: pizzaWalletCheckoutUrl(ctx) };
}

export function parseStellarTxHash(raw: string): string | null {
  const hash = raw.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) return null;
  return hash.toLowerCase();
}

/** Wallet origin needs the SEP-41 transfer (guest → store, 1 PIZZA) to sign. */
export function pizzaRedeemClientView(redeem: {
  id: string;
  status: string;
  amount: number;
  txHash: string | null;
  guestAddress: string;
  storeAddress: string;
  tokenId: string;
}) {
  return {
    id: redeem.id,
    status: redeem.status,
    amount: redeem.amount,
    txHash: redeem.txHash,
    guestAddress: redeem.guestAddress,
    storeAddress: redeem.storeAddress,
    tokenId: redeem.tokenId,
    transfer: {
      contractId: redeem.tokenId,
      method: "transfer" as const,
      from: redeem.guestAddress,
      to: redeem.storeAddress,
      amount: String(redeem.amount),
    },
    completesCheckoutSession: false as const,
  };
}
