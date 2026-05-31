/** Client-safe suggestion for org $tag from display name (3–30 chars, [a-z0-9_]). */
export function suggestOrgTagFromOrgName(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (s.length < 3) {
    s = s.length === 0 ? "org" : `${s}_org`;
    s = s.replace(/_+/g, "_").replace(/^_|_$/g, "");
  }
  if (s.length < 3) s = "org_tag";

  return s.slice(0, 30);
}
