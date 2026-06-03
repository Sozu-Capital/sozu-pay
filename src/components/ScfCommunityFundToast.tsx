"use client";

const SCF_COMMUNITY_FUND_URL = "https://communityfund.stellar.org";

type ScfCommunityFundToastProps = {
  visible?: boolean;
};

export function ScfCommunityFundToast({ visible = true }: ScfCommunityFundToastProps) {
  if (!visible) return null;

  return (
    <a
      href={SCF_COMMUNITY_FUND_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto fixed z-[45] block w-[7.5rem] shrink-0 animate-[home-scf-in_0.6s_ease-out_0.8s_both] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: "max(5.5rem, calc(1rem + env(safe-area-inset-bottom)))",
      }}
      aria-label="Stellar Community Fund"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/SCFbanner.avif"
        alt=""
        className="block h-auto w-full rounded-xl object-cover"
        draggable={false}
      />
    </a>
  );
}
