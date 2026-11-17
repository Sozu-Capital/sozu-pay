import { test, expect } from "@playwright/test";
import { FAKE_POLLAR_STAFF_WALLET } from "../src/lib/pollar/types";
import { fundTestnetPayer, sendTestnetUsdc } from "./stellar-payer";

function fakeToken(subject: string) {
  const email = `dev+${subject}_at_example.com`;
  return `fake.${subject}.${email}`;
}

test.describe("On-chain store checkout (testnet USDC)", () => {
  test.setTimeout(180_000);

  test("till walk: CLP create → paid → recon panel → CSV contains payment id", async ({
    request,
  }) => {
    const subject = `e2e-tx-${Date.now()}`;
    const verify = await request.post("/api/auth/pollar/verify", {
      data: { token: fakeToken(subject) },
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();

    const created = await request.post("/api/profile/org", {
      data: { name: `E2E Store ${subject.slice(-6)}`, type: "store" },
    });
    const createdBody = (await created.json()) as {
      error?: string;
      organization?: { id: string };
      org_treasury_wallet?: string;
    };
    expect(created.ok(), createdBody.error ?? JSON.stringify(createdBody)).toBeTruthy();

    const treasury = createdBody.org_treasury_wallet ?? "";
    expect(treasury.startsWith("G")).toBeTruthy();
    expect(treasury).not.toBe(FAKE_POLLAR_STAFF_WALLET);
    expect(treasury.length).toBeGreaterThanOrEqual(56);

    const ready = await request.get("/api/checkout/ready");
    expect((await ready.json()).ready).toBe(true);

    // POS keypad path: whole-peso CLP (server derives USDC). Persist fail-closed on create.
    const charge = await request.post("/api/checkout/create", {
      data: { amountClp: "1000", reference: `e2e-${subject}` },
    });
    const chargeBody = (await charge.json()) as {
      id?: string;
      amountUsd?: string;
      amountClp?: string;
      checkoutUrl?: string;
      error?: string;
    };
    expect(charge.ok(), chargeBody.error ?? JSON.stringify(chargeBody)).toBeTruthy();
    expect(chargeBody.id).toBeTruthy();
    expect(chargeBody.checkoutUrl).toBeTruthy();
    expect(chargeBody.amountClp).toBe("1000");
    const amountUsd = chargeBody.amountUsd ?? "";
    expect(parseFloat(amountUsd)).toBeGreaterThan(0);

    const payer = await fundTestnetPayer();
    const txHash = await sendTestnetUsdc({
      payer,
      destination: treasury,
      amount: amountUsd,
    });
    expect(txHash).toMatch(/^[a-f0-9]{64}$/i);
    expect(txHash.startsWith("fake-tx-")).toBeFalsy();

    await new Promise((r) => setTimeout(r, 3000));

    const complete = await request.post("/api/checkout/complete", {
      data: {
        id: chargeBody.id,
        transactionHash: txHash,
        paymentMethod: "sozu",
      },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();

    const recon = await request.get("/api/store/reconciliation");
    expect(recon.ok()).toBeTruthy();
    const summary = (await recon.json()) as {
      todayClp?: number;
      cycleChargeCount?: number;
      charges?: Array<{ id: string; amountClp: number; stellarTxHash: string | null }>;
    };
    expect(summary.cycleChargeCount ?? 0).toBeGreaterThanOrEqual(1);
    const row = summary.charges?.find((c) => c.id === chargeBody.id);
    expect(row?.stellarTxHash?.toLowerCase()).toBe(txHash.toLowerCase());
    expect(row?.amountClp).toBe(1000);

    const csvRes = await request.get("/api/store/reconciliation?format=csv");
    expect(csvRes.ok()).toBeTruthy();
    const csv = await csvRes.text();
    expect(csv).toMatch(/^id,completed_at,amount_clp/);
    expect(csv).toContain(chargeBody.id!);
    expect(csv).toMatch(/,1000,/);
  });
});
