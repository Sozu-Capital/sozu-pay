"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

type OrgType = "store" | "ngo";
type InviteRole = "member" | "admin" | "guardian" | "treasury_manager";

type InviteRow = { email: string; role: InviteRole };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export default function CreateOrganizationPage() {
  const [type, setType] = useState<OrgType>("ngo");
  const [orgName, setOrgName] = useState("My organization");
  const [sozuTag, setSozuTag] = useState("");
  const [guardianThreshold, setGuardianThreshold] = useState(2);
  const [invitesText, setInvitesText] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const invites: InviteRow[] = useMemo(() => {
    const emails = invitesText
      .split(/[\n,;]+/)
      .map(normalizeEmail)
      .filter((e) => e.includes("@"));
    // default all to member; creator will assign roles later (guardian/treasury_manager) in a dedicated screen
    const uniq = Array.from(new Set(emails));
    return uniq.map((email) => ({ email, role: "member" as const }));
  }, [invitesText]);

  async function handleCreate() {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/profile/org", {
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
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Failed to create organization");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  if (done) {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
            <h1 className="text-xl font-semibold text-white">
              Organization created
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              Next, pick the organization and continue. You’ll set up treasury passkeys and guardian recovery on the next steps.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/onboarding/organizations"
                className="w-full text-center rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
              >
                Choose organization & continue
              </Link>
              <Link
                href="/dashboard/profile"
                className="w-full text-center rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
              >
                Profile
              </Link>
            </div>
          </div>
        </main>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white">
            Create your organization
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            You’ll create a passkey-based smart treasury wallet (no secret keys). Add teammates now (optional); you can edit roles later.
          </p>

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-300">
                Organization name
              </label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. My NGO"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">
                Sozu tag (optional)
              </label>
              <input
                value={sozuTag}
                onChange={(e) => setSozuTag(e.target.value)}
                placeholder="$myorg"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                This will create your org receive tag (e.g. <span className="font-mono">$mujeres2000</span>).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("store")}
                disabled={creating}
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
                disabled={creating}
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
              <label className="text-xs font-medium text-gray-300">
                Guardian threshold (recovery)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={guardianThreshold}
                onChange={(e) => setGuardianThreshold(parseInt(e.target.value || "2", 10))}
                title="Guardian threshold"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                Used only for recovery/role changes. Normal payouts are single-signer.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">
                Invite team members (emails)
              </label>
              <textarea
                value={invitesText}
                onChange={(e) => setInvitesText(e.target.value)}
                rows={4}
                placeholder={"name@org.com\nother@org.com"}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                {invites.length} invite(s) parsed.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !orgName.trim()}
              className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create organization"}
            </button>
          </div>
        </div>
      </main>
    </DarkGradientBg>
  );
}
