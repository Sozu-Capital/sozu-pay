import type { SupportedLocale } from "@/lib/i18n/locale";

export class PayoutFundsError extends Error {
  readonly code = "INSUFFICIENT_DISBURSEMENT_BALANCE";
  readonly disbursementBalance: string;
  readonly requestedAmount: string;
  readonly treasuryBalance?: string;

  constructor(params: {
    message: string;
    disbursementBalance: string;
    requestedAmount: string;
    treasuryBalance?: string;
  }) {
    super(params.message);
    this.name = "PayoutFundsError";
    this.disbursementBalance = params.disbursementBalance;
    this.requestedAmount = params.requestedAmount;
    this.treasuryBalance = params.treasuryBalance;
  }
}

export function formatPayoutFundsError(
  error: PayoutFundsError,
  locale: SupportedLocale = "es"
): string {
  const disb = parseFloat(error.disbursementBalance) || 0;
  const req = parseFloat(error.requestedAmount) || 0;
  const treasury =
    error.treasuryBalance != null ? parseFloat(error.treasuryBalance) || 0 : null;

  if (locale === "en") {
    if (treasury != null) {
      return (
        `Not enough USDC across org wallets. Disbursement: ${disb.toFixed(2)} USDC, ` +
        `treasury: ${treasury.toFixed(2)} USDC, requested: ${req} USDC.`
      );
    }
    return (
      `Disbursement wallet has ${disb.toFixed(2)} USDC but this payout requires ${req} USDC. ` +
      `Send USDC to the disbursement contract or sweep from treasury first.`
    );
  }

  if (treasury != null) {
    return (
      `USDC insuficiente en las billeteras de la org. Desembolso: ${disb.toFixed(2)} USDC, ` +
      `tesorería: ${treasury.toFixed(2)} USDC, solicitado: ${req} USDC.`
    );
  }
  return (
    `La billetera de desembolso tiene ${disb.toFixed(2)} USDC pero este retiro requiere ${req} USDC. ` +
    `Transfiere USDC al contrato de desembolso o mueve fondos desde la tesorería.`
  );
}

export function formatSorobanPayoutError(
  raw: string,
  locale: SupportedLocale = "es"
): string {
  const text = raw.trim();
  const isEs = locale === "es";

  if (!text) {
    return isEs ? "El retiro falló. Inténtalo de nuevo." : "Payout failed. Please try again.";
  }

  if (text.includes("balance is not sufficient to spend")) {
    const amountMatch = text.match(/"amount":\s*(\d+)/);
    const haveMatch = text.match(/\{amount:\s*(\d+)/);
    const requested = amountMatch ? formatUsdcFromStroops(amountMatch[1]) : null;
    const available = haveMatch ? formatUsdcFromStroops(haveMatch[1]) : null;
    if (requested && available) {
      return isEs
        ? `Saldo insuficiente en la billetera de desembolso. Disponible: ${available} USDC. Solicitado: ${requested} USDC. ` +
            `Los depósitos en la tesorería se transfieren automáticamente al desembolsar; ` +
            `si el error continúa, verifica que tu passkey pueda firmar la tesorería org.`
        : `Insufficient disbursement wallet balance. Available: ${available} USDC. Requested: ${requested} USDC. ` +
            `Deposits in org treasury are swept automatically when paying out; ` +
            `if this persists, ensure your passkey can sign the org treasury smart account.`;
    }
    return isEs
      ? "Saldo USDC insuficiente en la billetera de desembolso para este retiro. " +
          "Comprueba el saldo en el panel y envía USDC al contrato de desembolso si es necesario."
      : "Insufficient USDC in the disbursement wallet for this payout. " +
          "Check the dashboard balance and fund the disbursement contract if needed.";
  }

  if (text.includes("__check_auth") || text.includes("InvalidAction")) {
    return isEs
      ? "La firma passkey fue rechazada. Cierra sesión, vuelve a entrar con passkey e inténtalo de nuevo."
      : "Passkey signature was rejected. Sign out, sign in with passkey again, and retry.";
  }

  if (text.includes("get_context_rules") || text.includes("non-existent contract function")) {
    return isEs
      ? "Error de firma passkey al preparar el retiro. Actualiza la página e inténtalo de nuevo; si persiste, cierra sesión y vuelve a entrar con passkey."
      : "Passkey signing failed while preparing payout. Refresh and retry; if it persists, sign out and sign in with passkey again.";
  }

  if (text.includes("No signer found") || text.includes("Signer keyData not found")) {
    return isEs
      ? "Tu passkey no está registrado en la billetera inteligente que debe firmar este paso (miembro o tesorería org). Usa el passkey con el que creaste esa billetera."
      : "Your passkey is not registered on the smart account that must sign this step (member or org treasury). Use the passkey used when that wallet was created.";
  }

  if (text.includes("No Soroban auth entries")) {
    return isEs
      ? "No hay entradas Soroban para firmar. Registra tu billetera passkey como firmante de la org."
      : text;
  }

  if (text.includes("Expected invokeHostFunction") || text.includes("Prepared payout has no operations")) {
    return isEs
      ? "Transacción de retiro inválida. Actualiza la página e inténtalo de nuevo."
      : "Invalid payout transaction. Refresh the page and try again.";
  }

  if (text.includes("HostError") && text.length > 200) {
    const idx = text.indexOf("balance is not sufficient");
    if (idx >= 0) {
      return formatSorobanPayoutError(text.slice(idx), locale);
    }
  }

  if (text.startsWith("Soroban submit failed:")) {
    return formatSorobanPayoutError(text.replace(/^Soroban submit failed:\s*/i, ""), locale);
  }

  return text.length > 280 ? `${text.slice(0, 280)}…` : text;
}

function formatUsdcFromStroops(stroops: string): string {
  const n = BigInt(stroops);
  const whole = Number(n) / 1e7;
  return whole.toFixed(7).replace(/\.?0+$/, "") || "0";
}
