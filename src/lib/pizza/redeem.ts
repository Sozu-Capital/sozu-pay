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
  | { kind: "hop"; url: string }
  | { kind: "auto_redeem"; guestAddress: string }
  | { kind: "chrome" };

export function pizzaWalletHopUrl(params: {
  walletOrigin: string;
  payUrl: string;
}): string {
  const returnTo = new URL(params.payUrl);
  returnTo.searchParams.set("hopped", "1");
  const url = new URL("/auth", params.walletOrigin.replace(/\/$/, ""));
  url.searchParams.set("return_to", returnTo.toString());
  return url.toString();
}

/** Pay.sozu.capital never prompts passkey/PIN — hop or chrome only. */
export function nextPizzaSkuGuestAction(
  search: PizzaSkuSearch,
  ctx: { payUrl: string; walletOrigin: string },
): PizzaSkuGuestNext {
  const intentId = search.intent?.trim();
  if (intentId) return { kind: "intent", intentId };

  if (search.pizza?.trim() === "0") return { kind: "chrome" };

  const guest = search.guest?.trim().toUpperCase();
  const pizzaRaw = search.pizza?.trim();
  const pizzaCount = pizzaRaw === undefined || pizzaRaw === "" ? null : Number(pizzaRaw);
  if (guest && (pizzaCount === null || pizzaCount >= 1)) {
    return { kind: "auto_redeem", guestAddress: guest };
  }

  if (search.hopped === "1") return { kind: "chrome" };

  return { kind: "hop", url: pizzaWalletHopUrl(ctx) };
}
