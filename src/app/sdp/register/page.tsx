import Link from "next/link";
import { SdpRegisterFlow } from "@/components/SdpRegisterFlow";

export const metadata = { title: "Recibir tu pago · Sozu" };

export default function SdpRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium">SozuPay · Desembolso</span>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
          Panel
        </Link>
      </header>
      <main className="p-6 max-w-3xl mx-auto">
        <SdpRegisterFlow />
      </main>
    </div>
  );
}
