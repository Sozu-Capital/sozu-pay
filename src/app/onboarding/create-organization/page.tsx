"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { getPrivyDisplayName } from "@/lib/auth/privyDisplayName";
import { registerSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient";

type OrgType = "store" | "ngo";
type InviteRole = "member" | "admin" | "guardian" | "treasury_manager";
type InviteRow = { email: string; role: InviteRole };

type SetupStep =
  | "idle"
  | "passkey"
  | "org"
  | "register"
  | "treasury"
  | "done"
  | "error";

const STEP_LABELS: Record<Exclude<SetupStep, "idle" | "error" | "done">, string> = {
  passkey: "Creating passkey smart wallet…",
  org: "Creating organization…",
  register: "Linking passkey to your org…",
  treasury: "Deploying disbursement treasury…",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { ready, kit, createWallet, error: kitError } = useSmartAccountKitContext();

  const [type, setType] = useState<OrgType>("ngo");
  const [orgName, setOrgName] = useState("My organization");
  const [sozuTag, setSozuTag] = useState("");
  const [guardianThreshold, setGuardianThreshold] = useState(2);
  const [invitesText, setInvitesText] = useState("");
  const [profileEmail, setProfileEmail] = useState("user");
  const [fullName, setFullName] = useState("");

  const [step, setStep] = useState<SetupStep>("idle");
  const [error, setError] = useState("");
  const [treasuryContractId, setTreasuryContractId] = useState<string | null>(null);
  const [memberContractId, setMemberContractId] = useState<string | null>(null);

  const invites: InviteRow[] = useMemo(() => {
    const emails = invitesText
      .split(/[\n,;]+/)
      .map(normalizeEmail)
      .filter((e) => e.includes("@"));
    const uniq = Array.from(new Set(emails));
    return uniq.map((email) => ({ email, role: "member" as const }));
  }, [invitesText]);

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.email === "string" && d.email) setProfileEmail(d.email);
        const tag = typeof d.username === "string" ? d.username : "";
        const name =
          tag && !tag.includes("@")
            ? `$${tag.replace(/^\$/, "")}`
            : getPrivyDisplayName(null, d.email ?? "");
        setFullName((prev) => prev || name);
      })
      .catch(() => {});
  }, []);

  const isBusy = step !== "idle" && step !== "done" && step !== "error";
  const canStart = ready && !!kit && !isBusy && orgName.trim().length > 0 && fullName.trim().length > 0;

  async function handleCreate() {
    if (!kit || !fullName.trim()) return;
    setError("");
    setStep("passkey");

    try {
      const wallet = await createWallet("SozuPay", fullName.trim());
      const memberC = wallet.contractId;
      const credId = wallet.credentialId;
      setMemberContractId(memberC);

      setStep("org");
      const orgRes = await fetch("/api/profile/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          name: orgName,
          sozuTag,
          guardianThreshold,
          invites,
        }),
      });
      const orgData = await orgRes.json().catch(() => ({}));
      if (!orgRes.ok) {
        throw new Error(orgData.error ?? "Failed to create organization");
      }

      setStep("register");
      await registerSmartAccount({
        type: "member",
        contractId: memberC,
        credentialId: credId,
        publicKey: wallet.publicKey,
        label: fullName.trim(),
      });

      setStep("treasury");
      const treasuryRes = await fetch("/api/profile/org/provision-treasury", {
        method: "POST",
        credentials: "include",
      });
      const treasuryData = await treasuryRes.json().catch(() => ({}));
      if (!treasuryRes.ok) {
        throw new Error(treasuryData.error ?? "Failed to provision org treasury");
      }

      setTreasuryContractId(treasuryData.soroban_contract_id ?? null);
      setStep("done");
    } catch (e) {
      setStep("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (step === "done") {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
            <h1 className="text-xl font-semibold text-white">Your NGO treasury is ready</h1>
            <p className="mt-2 text-sm text-gray-300">
              Passkey wallet and disbursement contract are live on testnet. Send USDC to your
              treasury address to fund batch disbursements.
            </p>
            {memberContractId && (
              <div className="mt-4 rounded-md border border-white/10 bg-black/30 p-3">
                <p className="text-xs text-gray-400">Your passkey smart account</p>
                <p className="mt-1 font-mono text-xs break-all text-white">{memberContractId}</p>
              </div>
            )}
            {treasuryContractId && (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-200">Fund this address with testnet USDC</p>
                <p className="mt-1 font-mono text-xs break-all text-white">{treasuryContractId}</p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.replace("/dashboard/disbursements")}
                className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
              >
                Go to disbursements
              </button>
              <button
                type="button"
                onClick={() => router.replace("/dashboard/profile")}
                className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
              >
                Profile & treasury
              </button>
            </div>
          </div>
        </main>
      </DarkGradientBg>
    );
  }

  if (isBusy) {
    const label = step in STEP_LABELS ? STEP_LABELS[step as keyof typeof STEP_LABELS] : "Setting up…";
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 shadow-xl text-center">
            <div
              className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin"
              aria-hidden
            />
            <h1 className="mt-6 text-lg font-semibold">Setting up your NGO treasury</h1>
            <p className="mt-2 text-sm text-gray-300">{label}</p>
            <p className="mt-4 text-xs text-gray-500">
              Keep this tab open — passkey and contract deployment may take a minute.
            </p>
          </div>
        </main>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white">Create your organization</h1>
          <p className="mt-2 text-sm text-gray-300">
            We&apos;ll create your passkey smart wallet and deploy your org treasury on testnet.
            You only need to add USDC afterward.
          </p>

          {(error || kitError) && (
            <p className="mt-3 text-sm text-red-400">{error || kitError}</p>
          )}

          {!ready && (
            <p className="mt-3 text-sm text-gray-400">Loading smart account kit…</p>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-300">Your full name (passkey label)</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Garcia"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              {profileEmail && (
                <p className="mt-1 text-xs text-gray-500">Login: {profileEmail}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">Organization name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. My NGO"
                disabled={false}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">Sozu tag (optional)</label>
              <input
                value={sozuTag}
                onChange={(e) => setSozuTag(e.target.value)}
                placeholder="$myorg"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("store")}
                className={`w-full rounded-md border py-3 px-3 text-left font-medium transition-colors ${
                  type === "store"
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                Store
              </button>
              <button
                type="button"
                onClick={() => setType("ngo")}
                className={`w-full rounded-md border py-3 px-3 text-left font-medium transition-colors ${
                  type === "ngo"
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                NGO
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">Guardian threshold (recovery)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={guardianThreshold}
                onChange={(e) => setGuardianThreshold(parseInt(e.target.value || "2", 10))}
                title="Guardian threshold"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">Invite team members (emails)</label>
              <textarea
                value={invitesText}
                onChange={(e) => setInvitesText(e.target.value)}
                rows={4}
                placeholder={"name@org.com\nother@org.com"}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-xs text-gray-400">{invites.length} invite(s) parsed.</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canStart}
              className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === "error" ? "Retry setup" : "Create organization & treasury"}
            </button>
          </div>
        </div>
      </main>
    </DarkGradientBg>
  );
}
