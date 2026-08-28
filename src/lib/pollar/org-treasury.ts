import type { User } from "@/lib/db/users";
import {
  FAKE_POLLAR_STAFF_WALLET,
  isFakePollarStaffWallet,
  usableClassicTreasuryPublicKey,
} from "@/lib/pollar/types";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";

export type OrgTreasuryProvisionResult = {
  publicKey: string;
  source: "creator_staff_pollar_wallet";
};

export interface OrgTreasuryProvisioner {
  /**
   * Resolve the Org treasury G-address for a new NGO (NO-GO fallback:
   * bind creator's Staff Pollar identity wallet).
   */
  provisionForCreator(creator: User): Promise<OrgTreasuryProvisionResult>;
}

export class CreatorBoundPollarTreasuryProvisioner implements OrgTreasuryProvisioner {
  async provisionForCreator(creator: User): Promise<OrgTreasuryProvisionResult> {
    if (!isPollarMappedUser(creator)) {
      throw new Error("Org treasury provisioner requires a Pollar-mapped creator");
    }
    const key = usableClassicTreasuryPublicKey(creator.stellar_public_key);
    if (!key) {
      throw new Error(
        isFakePollarStaffWallet(creator.stellar_public_key)
          ? "Creator wallet is a local stub, not a real Stellar account. Sign in again with Pollar so a funded Staff wallet can be linked."
          : "Creator Staff Pollar wallet address missing. Sign in again so the wallet can be linked.",
      );
    }
    return { publicKey: key, source: "creator_staff_pollar_wallet" };
  }
}

/**
 * Test / POLLAR_FAKE_AUTH only. May return the sentinel G for offline identity stubs.
 * Callers must run that G through usableClassicTreasuryPublicKey before persisting
 * it as a receivable treasury — local org-create then provisions a real testnet G.
 */
export class FakeOrgTreasuryProvisioner implements OrgTreasuryProvisioner {
  constructor(private readonly publicKey: string = FAKE_POLLAR_STAFF_WALLET) {}

  async provisionForCreator(creator: User): Promise<OrgTreasuryProvisionResult> {
    if (!isPollarMappedUser(creator)) {
      throw new Error("Fake provisioner requires Pollar-mapped creator");
    }
    const fromUser = usableClassicTreasuryPublicKey(creator.stellar_public_key);
    return {
      publicKey: fromUser ?? this.publicKey,
      source: "creator_staff_pollar_wallet",
    };
  }
}

export function createOrgTreasuryProvisioner(): OrgTreasuryProvisioner {
  if (process.env.POLLAR_FAKE_AUTH === "true" || process.env.NODE_ENV === "test") {
    return new FakeOrgTreasuryProvisioner();
  }
  return new CreatorBoundPollarTreasuryProvisioner();
}
