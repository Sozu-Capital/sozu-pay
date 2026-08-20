import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateStaffInvite,
  staffInvitePlaceholderEmail,
  isValidOrgInviteRole,
  mapInviteRoleToAdminLevel,
  nextAdminLevelAfterInvite,
  buildStaffInviteUrl,
  staffInviteLinkOrigin,
  staffInviteShareText,
  planStaffInviteAccept,
  STAFF_INVITE_TTL_MS,
} from "@/lib/org/staff-invite";

describe("validateStaffInvite", () => {
  it("rejects missing token", () => {
    const r = validateStaffInvite(null);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "NOT_FOUND");
  });

  it("rejects already-used (one-time)", () => {
    const r = validateStaffInvite({
      token: "t1",
      role: "member",
      expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_MS).toISOString(),
      acceptedAt: new Date().toISOString(),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "ALREADY_USED");
  });

  it("rejects expired", () => {
    const r = validateStaffInvite(
      {
        token: "t2",
        role: "admin",
        expiresAt: "2020-01-01T00:00:00.000Z",
        acceptedAt: null,
      },
      new Date("2024-01-01T00:00:00.000Z"),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "EXPIRED");
  });

  it("accepts valid unused unexpired invite with role", () => {
    const r = validateStaffInvite({
      token: "t3",
      role: "treasury_manager",
      expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_MS).toISOString(),
      acceptedAt: null,
    });
    assert.equal(r.ok, true);
  });
});

describe("staff invite helpers", () => {
  it("placeholder email is unique per token and not a real match target", () => {
    const a = staffInvitePlaceholderEmail("abc");
    const b = staffInvitePlaceholderEmail("xyz");
    assert.notEqual(a, b);
    assert.match(a, /@staff-invite\.local$/);
  });

  it("validates roles and maps admin levels", () => {
    assert.equal(isValidOrgInviteRole("admin"), true);
    assert.equal(isValidOrgInviteRole("hacker"), false);
    assert.equal(mapInviteRoleToAdminLevel("member"), "user");
    assert.equal(mapInviteRoleToAdminLevel("admin"), "admin");
    assert.equal(mapInviteRoleToAdminLevel("treasury_manager"), "admin");
    assert.equal(mapInviteRoleToAdminLevel("guardian"), "user");
    assert.equal(nextAdminLevelAfterInvite("super_admin", "member"), "super_admin");
    assert.equal(nextAdminLevelAfterInvite("admin", "member"), "admin");
    assert.equal(nextAdminLevelAfterInvite("user", "admin"), "admin");
    assert.equal(nextAdminLevelAfterInvite("user", "member"), "user");
  });

  it("builds join URL", () => {
    assert.equal(
      buildStaffInviteUrl("https://app.example.com/", "tok-1"),
      "https://app.example.com/join/tok-1",
    );
  });

  it("prefers the live request host over a localhost env URL", () => {
    assert.equal(
      staffInviteLinkOrigin({
        requestOrigin: "https://pay.sozu.capital",
        envAppUrl: "http://localhost:3000",
      }),
      "https://pay.sozu.capital",
    );
  });

  it("falls back to env when the request is localhost", () => {
    assert.equal(
      staffInviteLinkOrigin({
        requestOrigin: "http://localhost:3000",
        envAppUrl: "https://pay.sozu.capital",
      }),
      "https://pay.sozu.capital",
    );
  });

  it("share text names the org so a mixup is visible before send", () => {
    assert.equal(
      staffInviteShareText("Da Bruno Pizza", "https://pay.sozu.capital/join/tok"),
      "Join Da Bruno Pizza on SozuPay: https://pay.sozu.capital/join/tok",
    );
  });

  it("accept always switches primary to the invited org", () => {
    const switched = planStaffInviteAccept({
      userOrgId: "org-mujeres",
      inviteOrgId: "org-dabruno",
    });
    assert.equal(switched.primaryOrgId, "org-dabruno");
    assert.equal(switched.preservePreviousOrgId, "org-mujeres");

    const firstOrg = planStaffInviteAccept({
      userOrgId: null,
      inviteOrgId: "org-dabruno",
    });
    assert.equal(firstOrg.primaryOrgId, "org-dabruno");
    assert.equal(firstOrg.preservePreviousOrgId, null);
  });
});
