import { publicKeyToBase64Url } from "@/lib/stellar/smartAccounts/passkeyPublicKey";

export type RegisterSmartAccountType = "member" | "org_treasury";

export async function registerSmartAccount(params: {
  type: RegisterSmartAccountType;
  contractId: string;
  credentialId: string;
  publicKey: Uint8Array;
  label: string;
}): Promise<void> {
  const res = await fetch("/api/smart-accounts/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: params.type,
      contractId: params.contractId,
      credentialId: params.credentialId,
      publicKey65b: publicKeyToBase64Url(params.publicKey),
      label: params.label,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : res.status === 503
          ? "Passkey database tables are not set up yet. Contact your admin."
          : "Failed to save wallet";
    throw new Error(msg);
  }
}

/** Resolve public key when connect flow has no local credential (already deployed). */
export async function resolvePublicKeyFromServer(params: {
  contractId: string;
  credentialId: string;
}): Promise<Uint8Array> {
  const q = new URLSearchParams({
    contractId: params.contractId,
    credentialId: params.credentialId,
  });
  const res = await fetch(`/api/smart-accounts/resolve-public-key?${q}`, {
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as { publicKey65b?: string; error?: string };
  if (!res.ok || !data.publicKey65b) {
    throw new Error(data.error ?? "Could not resolve passkey public key");
  }
  const padded = data.publicKey65b.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
