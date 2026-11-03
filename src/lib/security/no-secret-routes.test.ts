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

const routes = listRouteFiles(apiDir).map((file) => ({
  name: path.relative(apiDir, file),
  source: readFileSync(file, "utf8"),
}));

/** Routes that decrypt the org secret to sign server-side and never put it in a response. */
const SERVER_SIDE_SIGNERS = new Set(["payouts/route.ts"]);

describe("no API route reveals secret key material", () => {
  it("the org secret reveal route is gone", () => {
    assert.equal(existsSync(path.join(apiDir, "profile/org/secret/route.ts")), false);
  });

  it("finds the route tree", () => {
    assert.ok(routes.length > 50, `expected the API route tree, found ${routes.length} routes`);
  });

  it("only reviewed server-side signers decrypt the org secret", () => {
    const decrypting = routes.filter((r) => r.source.includes("decryptOrgSecret")).map((r) => r.name);
    assert.deepEqual(decrypting.filter((name) => !SERVER_SIDE_SIGNERS.has(name)), []);
  });

  it("no route puts a secret key or seed in a JSON response", () => {
    const pattern =
      /NextResponse\.json\(\s*\{[^}]*\b(secretKey|secret_key|privateKey|seed|mnemonic)\b\s*[,}:]/;
    const offenders = routes.filter((r) => pattern.test(r.source)).map((r) => r.name);
    assert.deepEqual(offenders, []);
  });

  it("no route serializes a Keypair secret", () => {
    const offenders = routes
      .filter((r) => /NextResponse\.json\([^;]*\.secret\(\)/.test(r.source))
      .map((r) => r.name);
    assert.deepEqual(offenders, []);
  });
});
