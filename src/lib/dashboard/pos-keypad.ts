/** Keys the POS amount keypad can emit. */
export type PosKeypadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "backspace";

export type ApplyPosKeypadOptions = {
  /** Max digits after decimal. Use 0 for whole-peso CLP (rejects `.`). Default 2. */
  maxFractionDigits?: number;
  maxIntegerDigits?: number;
};

const DEFAULT_MAX_FRACTION_DIGITS = 2;
const DEFAULT_MAX_INTEGER_DIGITS = 9;

/**
 * Apply one keypad press to the current amount string.
 * Rejects a second decimal and caps fraction digits so the hero display stays valid money input.
 */
export function applyPosKeypadKey(
  current: string,
  key: PosKeypadKey,
  options: ApplyPosKeypadOptions = {},
): string {
  const maxFractionDigits = options.maxFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS;
  const maxIntegerDigits = options.maxIntegerDigits ?? DEFAULT_MAX_INTEGER_DIGITS;
  const raw = current.trim();

  if (key === "backspace") {
    return raw.slice(0, -1);
  }

  if (key === ".") {
    if (maxFractionDigits <= 0) return raw;
    if (raw.includes(".")) return raw;
    return raw.length === 0 ? "0." : `${raw}.`;
  }

  // Digit (`.` already handled above)
  if (raw === "0") {
    return key;
  }

  const dot = raw.indexOf(".");
  if (dot >= 0) {
    if (maxFractionDigits <= 0) return raw;
    const fraction = raw.slice(dot + 1);
    if (fraction.length >= maxFractionDigits) return raw;
    return `${raw}${key}`;
  }

  // Avoid a leading zero run like "00"
  if (raw === "" && key === "0") return "0";
  if (raw.length >= maxIntegerDigits) return raw;
  return `${raw}${key}`;
}

/** Hero display for the keypad amount (empty → 0). */
export function formatPosKeypadDisplay(amount: string): string {
  const trimmed = amount.trim();
  return trimmed.length === 0 ? "0" : trimmed;
}
