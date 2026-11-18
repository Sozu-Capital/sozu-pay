import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSouvenirLaunch, souvenirSlug } from "./launch.js";

describe("merchant souvenir launch", () => {
  it("takes an image, a title, and a claim window", () => {
    const parsed = parseSouvenirLaunch({
      title: "Noche Pizza",
      imageUrl: "data:image/jpeg;base64,aaaa",
      claimStartsAt: "2026-11-18T20:00:00.000-03:00",
      claimEndsAt: "2026-11-19T02:00:00.000-03:00",
      merchantOrgId: "org_1",
      merchantName: "Da Bruno",
    });
    assert.equal("error" in parsed, false);
    if ("error" in parsed) return;
    assert.equal(parsed.title, "Noche Pizza");
    assert.equal(parsed.merchantName, "Da Bruno");
    assert.ok(parsed.claimEndsAt > parsed.claimStartsAt);
  });

  it("refuses a closed window or a missing photo", () => {
    assert.deepEqual(
      parseSouvenirLaunch({
        title: "Noche",
        claimStartsAt: "2026-11-18T00:00:00.000Z",
        claimEndsAt: "2026-11-19T00:00:00.000Z",
        merchantOrgId: "org_1",
      }),
      { error: "invalid_image" },
    );
    assert.deepEqual(
      parseSouvenirLaunch({
        title: "Noche",
        imageUrl: "data:image/jpeg;base64,aa",
        claimStartsAt: "2026-11-19T00:00:00.000Z",
        claimEndsAt: "2026-11-18T00:00:00.000Z",
        merchantOrgId: "org_1",
      }),
      { error: "invalid_window" },
    );
  });

  it("builds a slug every wallet can look up", () => {
    assert.equal(souvenirSlug("Noche Pizza", "AbC-999"), "noche-pizza-abc999");
  });
});
