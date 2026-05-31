/** Client-only keys page; avoid static prerender crash. */
export const dynamic = "force-dynamic";

export default function KeysLayout({ children }: { children: React.ReactNode }) {
  return children;
}
