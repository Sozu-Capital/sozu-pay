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

const MAX_FRACTION_DIGITS = 2;
const MAX_INTEGER_DIGITS = 9;

/**
 * Apply one keypad press to the current amount string.
 * Rejects a second decimal and caps fraction digits so the hero display stays valid money input.
 */
export function applyPosKeypadKey(current: string, key: PosKeypadKey): string {
  const raw = current.trim();

  if (key === "backspace") {
    return raw.slice(0, -1);
  }

  if (key === ".") {
    if (raw.includes(".")) return raw;
    return raw.length === 0 ? "0." : `${raw}.`;
  }

  // Digit (`.` already handled above)
  if (raw === "0") {
    return key;
  }

  const dot = raw.indexOf(".");
  if (dot >= 0) {
    const fraction = raw.slice(dot + 1);
    if (fraction.length >= MAX_FRACTION_DIGITS) return raw;
    return `${raw}${key}`;
  }

  // Avoid a leading zero run like "00"
  if (raw === "" && key === "0") return "0";
  if (raw.length >= MAX_INTEGER_DIGITS) return raw;
  return `${raw}${key}`;
}

/** Hero display for the keypad amount (empty → 0). */
export function formatPosKeypadDisplay(amount: string): string {
  const trimmed = amount.trim();
  return trimmed.length === 0 ? "0" : trimmed;
}
