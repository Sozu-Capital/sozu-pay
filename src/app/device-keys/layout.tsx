/** Client-only Pollar device-key recovery; skip static prerender. */
export const dynamic = "force-dynamic";

export default function DeviceKeysLayout({ children }: { children: React.ReactNode }) {
  return children;
}
