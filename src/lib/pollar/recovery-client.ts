"use client";

import type { PollarClient } from "@pollar/core";
import { waitForPollarAuthState } from "@/lib/pollar/browser-client";
import {
  classifyDeviceKeys,
  extractCompressedPublicKeys,
  pollarErrorMessage,
  type DeviceKeyMatch,
} from "@/lib/pollar/device-keys";

export type PollarRecoveryEmail = {
  address: string | null;
  verified: boolean;
};

export type PollarRecoveryStatus = {
  required: boolean;
  configured: boolean;
  email: PollarRecoveryEmail | null;
  passkeyCount: number;
  raw: unknown;
};

export type PollarCosignSnapshot = {
  walletAddress: string | null;
  provisioning: string | null;
  localPublicKeyHex: string | null;
  recovery: PollarRecoveryStatus | null;
  enrolledPublicKeys: string[];
  enrollments: unknown;
  devicesRaw: unknown;
  recoveryError: string | null;
  devicesError: string | null;
  localKeyError: string | null;
  authStep: string;
  authVerified: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseRecoveryStatus(raw: unknown): PollarRecoveryStatus {
  const row = asRecord(raw) ?? {};
  const emailRow = asRecord(row.email);
  const address =
    typeof emailRow?.address === "string"
      ? emailRow.address
      : typeof emailRow?.email === "string"
        ? emailRow.email
        : null;
  const passkeys = Array.isArray(row.passkeys) ? row.passkeys : [];
  return {
    required: row.required === true,
    configured: row.configured === true,
    email: emailRow
      ? { address, verified: emailRow.verified === true }
      : null,
    passkeyCount: passkeys.length,
    raw,
  };
}

export function pollarRecoveryApi(client: PollarClient): PollarClient["cosign"]["recovery"] {
  return client.cosign.recovery;
}

export async function snapshotPollarCosign(client: PollarClient): Promise<PollarCosignSnapshot> {
  const auth = await waitForPollarAuthState(client);
  const wallet = client.getWallet() as
    | { address?: string; provisioning?: string }
    | null
    | undefined;

  let localPublicKeyHex: string | null = null;
  let localKeyError: string | null = null;
  try {
    localPublicKeyHex = await client.cosign.publicKeyHex();
  } catch (err) {
    localKeyError = pollarErrorMessage(err);
  }

  const empty: PollarCosignSnapshot = {
    walletAddress: typeof wallet?.address === "string" ? wallet.address : null,
    provisioning: typeof wallet?.provisioning === "string" ? wallet.provisioning : null,
    localPublicKeyHex,
    recovery: null,
    enrolledPublicKeys: [],
    enrollments: null,
    devicesRaw: null,
    recoveryError: null,
    devicesError: null,
    localKeyError,
    authStep: auth.step,
    authVerified: auth.verified,
  };

  if (auth.step !== "authenticated" || !auth.verified) {
    return empty;
  }

  let recovery: PollarRecoveryStatus | null = null;
  let recoveryError: string | null = null;
  try {
    recovery = parseRecoveryStatus(await client.cosign.recovery.status());
  } catch (err) {
    recoveryError = pollarErrorMessage(err);
  }

  let devicesRaw: unknown = null;
  let devicesError: string | null = null;
  try {
    devicesRaw = await client.cosign.devices();
  } catch (err) {
    devicesError = pollarErrorMessage(err);
  }

  const enrolledPublicKeys = devicesError
    ? []
    : extractCompressedPublicKeys([devicesRaw, recovery?.raw]);

  return {
    ...empty,
    recovery,
    enrolledPublicKeys,
    enrollments: asRecord(devicesRaw)?.enrollments ?? null,
    devicesRaw,
    recoveryError,
    devicesError,
  };
}

export function matchLocalToEnrolled(
  localPublicKeys: string[],
  snapshot: PollarCosignSnapshot,
): DeviceKeyMatch {
  return classifyDeviceKeys({
    localPublicKeys,
    enrolledPublicKeys: snapshot.enrolledPublicKeys,
  });
}
