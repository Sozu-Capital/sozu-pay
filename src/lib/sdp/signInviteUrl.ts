/**
 * Builds and signs a SDP wallet-registration deep link.
 *
 * Algorithm mirrors github.com/stellar/stellar-disbursement-platform-backend
 * internal/utils/url.go SignURL and is verified by SozuCredit's
 * lib/sdp/verifyInviteUrl.ts verifySdpRegistrationUrl.
 *
 * URL format:
 *   {walletInviteUrl}?asset={code}-{issuer}&domain={sdpHost}&name={orgName}&signature={hexSig}
 *
 * Params are sorted alphabetically (asset < domain < name) before signing so
 * that the verifier's encodeQuerySorted reconstruction matches.
 */

import { Keypair } from "@stellar/stellar-sdk";

/** Encode URLSearchParams with encodeURIComponent (space → %20, not +). */
function encodeQuerySorted(params: URLSearchParams): string {
  const byKey = new Map<string, string[]>();
  Array.from(params.keys()).forEach((key) => {
    if (!byKey.has(key)) byKey.set(key, params.getAll(key));
  });
  const keys = Array.from(byKey.keys()).sort();
  const parts: string[] = [];
  keys.forEach((k) => {
    (byKey.get(k) ?? []).forEach((v) => {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    });
  });
  return parts.join("&");
}

/**
 * Build and sign a wallet registration deep link using SDP's SEP-10 signing key.
 *
 * @param walletInviteUrl  Full URL to the wallet's invite route,
 *                         e.g. "https://credit.sozu.capital/sdp/invite"
 * @param assetCode        e.g. "USDC"
 * @param assetIssuer      Stellar account ID of the asset issuer (empty = native XLM)
 * @param sdpDomain        Hostname of the SDP tenant,
 *                         e.g. "sdp-v2-production-f6c7.up.railway.app"
 * @param orgName          Organization display name, e.g. "Sozu Capital"
 * @param sep10SigningKey   Stellar secret key (SDP's SEP10_SIGNING_PRIVATE_KEY)
 */
export function signSdpInviteUrl(
  walletInviteUrl: string,
  assetCode: string,
  assetIssuer: string,
  sdpDomain: string,
  orgName: string,
  sep10SigningKey: string
): string {
  const asset = assetIssuer ? `${assetCode}-${assetIssuer}` : "native";

  const params = new URLSearchParams();
  params.set("asset", asset);
  params.set("domain", sdpDomain);
  params.set("name", orgName);

  const sortedQs = encodeQuerySorted(params);
  const unsignedUrl = `${walletInviteUrl}?${sortedQs}`;

  const kp = Keypair.fromSecret(sep10SigningKey);
  const sigBytes = kp.sign(Buffer.from(unsignedUrl, "utf8"));
  const sigHex = Buffer.from(sigBytes).toString("hex");

  return `${unsignedUrl}&signature=${sigHex}`;
}
