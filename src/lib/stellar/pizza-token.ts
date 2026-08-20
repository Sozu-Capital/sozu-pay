/** Testnet PizzaToken (SEP-41). Not Circle USDC — never fall back to SOROBAN_USDC_TOKEN_ID. */

export const PIZZA_NAME = "Pizza";
export const PIZZA_SYMBOL = "PIZZA";
export const PIZZA_DECIMALS = 0;
export const PIZZA_PREMINT = 20;

export function isPizzaTokenConfigured(): boolean {
  return Boolean(process.env.SOROBAN_PIZZA_TOKEN_ID?.trim());
}

export function getPizzaTokenId(): string {
  const fromEnv = process.env.SOROBAN_PIZZA_TOKEN_ID?.trim();
  if (!fromEnv) {
    throw new Error("SOROBAN_PIZZA_TOKEN_ID is required (testnet PizzaToken contract id).");
  }
  return fromEnv;
}

/** Whole pizzas only (0 decimals). Redeem amount is always 1. */
export function pizzaAmountToI128(amount: number | string): bigint {
  const num = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`PizzaToken amount must be a non-negative integer, got ${amount}`);
  }
  return BigInt(num);
}
