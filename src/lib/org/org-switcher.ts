/** Two-letter avatar label for the org switcher, Google-account-picker style. */
export function orgSwitcherInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const a = Array.from(parts[0])[0] ?? "";
  const b = Array.from(parts[1])[0] ?? "";
  return `${a}${b}`.toUpperCase();
}
