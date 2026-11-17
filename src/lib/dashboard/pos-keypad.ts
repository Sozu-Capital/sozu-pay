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

/** Map a physical keyboard event to a keypad key. Null when the key is not amount input. */
export function posKeyFromKeyboard(key: string, code?: string): PosKeypadKey | null {
  if (key === "Backspace" || key === "Delete") return "backspace";
  if (key === "." || key === "," || code === "NumpadDecimal") return ".";
  if (/^[0-9]$/.test(key)) return key as PosKeypadKey;
  if (code?.startsWith("Numpad")) {
    const digit = code.slice("Numpad".length);
    if (/^[0-9]$/.test(digit)) return digit as PosKeypadKey;
  }
  if (code?.startsWith("Digit")) {
    const digit = code.slice("Digit".length);
    if (/^[0-9]$/.test(digit)) return digit as PosKeypadKey;
  }
  return null;
}

/**
 * Replace the amount with what a focused field would contain after typing or paste.
 * Whole-peso CLP ignores separators, so "15.000" and "15000" are the same entry.
 */
export function amountFromPosTyping(
  raw: string,
  options: ApplyPosKeypadOptions = {},
): string {
  const maxFractionDigits = options.maxFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS;
  const maxIntegerDigits = options.maxIntegerDigits ?? DEFAULT_MAX_INTEGER_DIGITS;
  if (maxFractionDigits <= 0) {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits.slice(0, maxIntegerDigits);
  }

  let next = "";
  for (const ch of raw) {
    const key = posKeyFromKeyboard(ch);
    if (key && key !== "backspace") next = applyPosKeypadKey(next, key, options);
  }
  return next;
}

/** Enter confirms the charge from a desktop keyboard. */
export function isPosSubmitKey(key: string): boolean {
  return key === "Enter";
}

/** Hero display for the keypad amount (empty → 0). */
export function formatPosKeypadDisplay(amount: string): string {
  const trimmed = amount.trim();
  return trimmed.length === 0 ? "0" : trimmed;
}
