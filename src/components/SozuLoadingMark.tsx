/**
 * Small white November mark, centered, pulsing opacity while a screen is loading.
 * Artwork is the Sozu Wallet November 2026 mark (white ribbon, transparent ground).
 */
export function SozuLoadingMark({
  mode = "viewport",
  scrim = false,
}: {
  mode?: "viewport" | "inline";
  /** Dark full-screen ground so the white mark stays visible on light pages. */
  scrim?: boolean;
}) {
  const mark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/november-2026/mark.png"
      alt=""
      width={64}
      height={64}
      className="sozu-load-mark h-16 w-16 object-contain"
    />
  );

  if (mode === "inline") {
    return <div className="flex items-center justify-center py-8">{mark}</div>;
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center ${scrim ? "bg-[#131210]" : ""}`}
      aria-busy="true"
      aria-live="polite"
    >
      {mark}
    </div>
  );
}
