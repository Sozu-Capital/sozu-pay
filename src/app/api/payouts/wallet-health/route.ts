import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { probeClassicWallet } from "@/lib/payouts/wallet-health";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";

/**
 * Probe XLM/USDC on wallets that matter for Pollar Home treasury payouts.
 * Use this when "Settings wallets have XLM" but Pollar says TX_INSUFFICIENT_FEE.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = user.org_id ? await getOrganizationForUser(user.org_id) : null;
  const homeG = (org?.stellar_disbursement_public_key ?? "").trim();
  const userG = (user.stellar_public_key ?? "").trim();

  let envPayoutG: string | null = null;
  for (const key of [
    "ORG_DISBURSEMENT_SECRET",
    "STELLAR_DISBURSEMENT_SECRET",
    "STELLAR_FUNDER_SECRET",
  ] as const) {
    const secret = process.env[key]?.trim();
    if (!secret) continue;
    try {
      envPayoutG = Keypair.fromSecret(secret).publicKey();
      break;
    } catch {
      // skip
    }
  }

  const probes: Array<ReturnType<typeof probeClassicWallet>> = [];
  if (homeG.startsWith("G")) {
    probes.push(probeClassicWallet(homeG, "home_treasury (signs Pollar payouts)"));
  }
  if (userG.startsWith("G") && userG !== homeG) {
    probes.push(probeClassicWallet(userG, "user.stellar_public_key (Pollar login wallet)"));
  }
  if (envPayoutG && envPayoutG !== homeG && envPayoutG !== userG) {
    probes.push(
      probeClassicWallet(envPayoutG, "env ORG_DISBURSEMENT/FUNDER (legacy hot key — not used for Pollar)"),
    );
  }

  const wallets = await Promise.all(probes);
  const signing = wallets.find((w) => w.role.startsWith("home_treasury")) ?? null;

  return NextResponse.json({
    network: process.env.STELLAR_NETWORK === "public" ? "public" : "testnet",
    isPollarUser: isPollarMappedUser(user),
    explanation:
      "Pollar 'Not enough XLM' means the signing wallet (Home treasury) lacks spendable XLM after reserves, or Pollar app sponsorship failed. Settings can show other wallets that are funded — those do not pay this fee.",
    signingWallet: signing,
    wallets,
  });
}
