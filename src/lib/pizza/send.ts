import { buildSep41TransferCall, type Sep41TransferCall } from "@/lib/pizza/redeem";
import { parsePizzaSendAmount } from "@/lib/payouts/asset";
import { pizzaAmountToI128 } from "@/lib/stellar/pizza-token";

/** Store treasury → app.sozu.capital wallet. Whole pizzas, never USDC. */
export function buildPizzaPayoutTransfer(params: {
  pizzaTokenId: string;
  fromStore: string;
  toWallet: string;
  amount: string;
}): Sep41TransferCall {
  return buildSep41TransferCall({
    tokenId: params.pizzaTokenId,
    from: params.fromStore,
    to: params.toWallet,
    amount: pizzaAmountToI128(parsePizzaSendAmount(params.amount)),
  });
}
