import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const apiDir = path.resolve(import.meta.dirname, "../../app/api");

function listRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) listRouteFiles(full, out);
    else if (/^route\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const routes = listRouteFiles(apiDir).map((file) => ({
  name: path.relative(apiDir, file),
  source: stripComments(readFileSync(file, "utf8")),
}));

/**
 * Any object literal with a secret-named key, nested or built before the response, counts:
 * `{ data: {}, secretKey }` and `const body = { secretKey }` are both caught.
 */
const SECRET_KEY_IN_OBJECT =
  /[{,]\s*["']?(secretKey|secret_key|secretSeed|privateKey|private_key|seed|mnemonic|orgSecret|decryptedSecret)["']?\s*[:,}]/;

function putsSecretInObject(source: string): boolean {
  return SECRET_KEY_IN_OBJECT.test(stripComments(source));
}

/** Routes that hold secret material server-side and never put it in a response. Each needs a reason. */
const REVIEWED_SECRET_HANDLERS: Record<string, string> = {
  "payouts/route.ts": "decrypts the org secret to sign a payout server-side",
  "auth/unlock-wallet/route.ts": "keeps the unlocked key in server memory and an httpOnly cookie; returns only the public key",
};

describe("secret detector", () => {
  it("catches a secret next to other fields in a response", () => {
    assert.ok(putsSecretInObject("return NextResponse.json({ data: {}, secretKey });"));
  });

  it("catches a secret in an object built before the response", () => {
    assert.ok(putsSecretInObject("const body = { secretKey };\nreturn NextResponse.json(body);"));
  });

  it("catches a nested secret property", () => {
    assert.ok(putsSecretInObject("NextResponse.json({ wallet: { publicKey, seed: kp.secret() } })"));
  });

  it("ignores reading a secret from the request body and comments", () => {
    assert.equal(putsSecretInObject("const s = body.secretKey; // { secretKey }"), false);
  });
});

describe("no API route reveals secret key material", () => {
  it("the org secret reveal route is gone", () => {
    assert.equal(existsSync(path.join(apiDir, "profile/org/secret/route.ts")), false);
  });

  it("finds the route tree", () => {
    assert.ok(routes.length > 50, `expected the API route tree, found ${routes.length} routes`);
  });

  it("only reviewed routes decrypt the org secret or read a Keypair secret", () => {
    const handlers = routes
      .filter((r) => r.source.includes("decryptOrgSecret") || /\.secret\(\)/.test(r.source))
      .map((r) => r.name);
    assert.deepEqual(handlers.filter((name) => !(name in REVIEWED_SECRET_HANDLERS)), []);
  });

  it("no route builds an object with a secret key or seed", () => {
    const offenders = routes.filter((r) => putsSecretInObject(r.source)).map((r) => r.name);
    assert.deepEqual(offenders, []);
  });
});
