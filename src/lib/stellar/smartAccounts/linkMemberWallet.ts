import type { SmartAccountKit } from "smart-account-kit";
import { base64URLToBuffer, normalizeCredentialId } from "@/lib/webauthn/utils";
import { resolvePublicKeyFromServer } from "@/lib/stellar/smartAccounts/registerWalletClient";

type ConnectResult = {
  contractId: string | null;
  credentialId: string | null;
  publicKey?: Uint8Array | null;
};

type ConnectFn = (opts?: {
  prompt?: boolean;
  credentialId?: string;
  contractId?: string;
}) => Promise<ConnectResult>;

function isNotDeployedError(message: string): boolean {
  return (
    message.includes("not found on-chain") ||
    message.includes("not deployed") ||
    message.includes("not been deployed")
  );
}

async function finishLink(
  linked: ConnectResult
): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array }> {
  if (!linked.contractId || !linked.credentialId) {
    throw new Error("PASSKEY_WALLET_NOT_LINKED");
  }
  let publicKey = linked.publicKey ?? null;
  if (!publicKey) {
    publicKey = await resolvePublicKeyFromServer({
      contractId: linked.contractId,
      credentialId: linked.credentialId,
    });
  }
  return {
    contractId: linked.contractId,
    credentialId: linked.credentialId,
    publicKey,
  };
}

/**
 * Link (or deploy) the member smart account using the same passkey as login — never creates a new passkey.
 */
export async function linkMemberWalletWithLoginPasskey(params: {
  kit: SmartAccountKit;
  connect: ConnectFn;
  loginCredentialId?: string;
}): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array }> {
  const { kit, connect, loginCredentialId } = params;

  if (loginCredentialId) {
    try {
      return await finishLink(await connect({ credentialId: loginCredentialId }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isNotDeployedError(msg)) throw e;
    }
  }

  try {
    return await finishLink(await connect({ prompt: true }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isNotDeployedError(msg)) throw e;
  }

  const { credentialId: authedId } = await kit.authenticatePasskey();
  if (
    loginCredentialId &&
    normalizeCredentialId(authedId) !== normalizeCredentialId(loginCredentialId)
  ) {
    throw new Error("WRONG_PASSKEY");
  }

  const contracts = await kit.discoverContractsByCredential(authedId);
  const first = contracts?.[0];
  const contractId =
    first && typeof first === "object"
      ? ("contract_id" in first && typeof first.contract_id === "string"
          ? first.contract_id
          : "contractId" in first && typeof first.contractId === "string"
            ? first.contractId
            : null)
      : null;

  if (contractId) {
    return await finishLink(
      await connect({ credentialId: authedId, contractId })
    );
  }

  const primaryRes = await fetch("/api/auth/passkeys/primary", { credentials: "include" });
  const primary = (await primaryRes.json().catch(() => ({}))) as {
    publicKey65b?: string;
    error?: string;
  };
  if (!primaryRes.ok || !primary.publicKey65b) {
    throw new Error("PASSKEY_PUBLIC_KEY_MISSING");
  }

  const publicKey = new Uint8Array(base64URLToBuffer(primary.publicKey65b));
  await kit.credentials.save({
    credentialId: authedId,
    publicKey,
  });
  await kit.credentials.deploy(authedId, { autoSubmit: true });
  return await finishLink(await connect({ credentialId: authedId }));
}
