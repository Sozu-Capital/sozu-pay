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
      className="pointer-events-auto fixed z-[45] block animate-[home-scf-in_0.6s_ease-out_0.8s_both] rounded-tl-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
      style={{
        right: 0,
        bottom: 0,
        width: "min(50vw, 15rem)",
      }}
      aria-label="Stellar Community Fund"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/SCFbanner.avif"
        alt=""
        className="block h-auto w-full rounded-tl-2xl object-cover object-right-bottom"
        draggable={false}
      />
    </a>
  );
}
