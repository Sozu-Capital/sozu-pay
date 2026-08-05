import type { User } from "@/lib/db/users";
import { FAKE_POLLAR_STAFF_WALLET } from "@/lib/pollar/types";
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
    const key = (creator.stellar_public_key ?? "").trim();
    if (!key.startsWith("G") || key.length < 56) {
      throw new Error(
        "Creator Staff Pollar wallet address missing. Sign in again so the wallet can be linked.",
      );
    }
    return { publicKey: key, source: "creator_staff_pollar_wallet" };
  }
}

export class FakeOrgTreasuryProvisioner implements OrgTreasuryProvisioner {
  constructor(private readonly publicKey: string = FAKE_POLLAR_STAFF_WALLET) {}

  async provisionForCreator(creator: User): Promise<OrgTreasuryProvisionResult> {
    if (!isPollarMappedUser(creator)) {
      throw new Error("Fake provisioner requires Pollar-mapped creator");
    }
    const fromUser = (creator.stellar_public_key ?? "").trim();
    return {
      publicKey: fromUser.startsWith("G") ? fromUser : this.publicKey,
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
