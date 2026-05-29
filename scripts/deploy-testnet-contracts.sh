#!/usr/bin/env bash
# Upload disbursement_wallet WASM to Stellar testnet and record addresses in docs + .env.local hints.
#
# Prerequisites:
#   - stellar CLI (https://developers.stellar.org/docs/tools/cli)
#   - STELLAR_FUNDER_SECRET in environment or .env.local (Friendbot-funded G account)
#
# Usage:
#   export STELLAR_FUNDER_SECRET=SB...
#   ./scripts/deploy-testnet-contracts.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/contracts/disbursement_wallet/target/wasm32-unknown-unknown/release/disbursement_wallet.wasm"
DOCS="$ROOT/docs/02-contracts/testnet-contracts.md"
USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

if [[ -f "$ROOT/.env.local" ]]; then
  # Load only scalar vars (avoid multiline PEM blocks breaking source).
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    [[ "$line" == *"="* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key// /}"
    case "$key" in
      STELLAR_FUNDER_SECRET|SOROBAN_RPC_URL|DISBURSEMENT_WALLET_WASM_HASH)
        if [[ -z "${!key:-}" ]]; then
          export "${key}=${val}"
        fi
        ;;
    esac
  done < "$ROOT/.env.local"
fi

if [[ -z "${STELLAR_FUNDER_SECRET:-}" ]]; then
  echo "ERROR: STELLAR_FUNDER_SECRET is required (fund via Friendbot first)." >&2
  exit 1
fi

if [[ ! -f "$WASM" ]]; then
  echo "Building disbursement_wallet WASM…"
  (cd "$ROOT/contracts/disbursement_wallet" && cargo build --target wasm32-unknown-unknown --release)
fi

echo "Uploading disbursement_wallet WASM to testnet…"
UPLOAD_OUT="$(stellar contract upload \
  --wasm "$WASM" \
  --source-account "$STELLAR_FUNDER_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" 2>&1)"
echo "$UPLOAD_OUT"

WASM_HASH="$(echo "$UPLOAD_OUT" | grep -Eo '[a-f0-9]{64}' | tail -1)"
if [[ -z "$WASM_HASH" ]]; then
  echo "ERROR: Could not parse WASM hash from upload output." >&2
  exit 1
fi

echo "Resolving USDC SAC contract ID…"
USDC_SAC="$(stellar contract id asset \
  --asset "USDC:${USDC_ISSUER}" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" 2>&1 | grep -Eo 'C[A-Z0-9]{55}' | tail -1)"

if [[ -z "$USDC_SAC" ]]; then
  USDC_SAC="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
  echo "Using canonical testnet USDC SAC: $USDC_SAC"
else
  echo "USDC SAC: $USDC_SAC"
fi

echo ""
echo "=== Add to .env.local ==="
echo "STELLAR_FUNDER_SECRET=<your funder secret>"
echo "SOROBAN_RPC_URL=$RPC_URL"
echo "SOROBAN_USDC_TOKEN_ID=$USDC_SAC"
echo "DISBURSEMENT_WALLET_WASM_HASH=$WASM_HASH"
echo "OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c"
echo "OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET=CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH"
echo "OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET=CDDQLFG7CV74QHWPSP6NZIPNBR2PPCMTUVYCJF4P3ONDYHODRFGR7LWC"
echo ""

# Patch testnet-contracts.md placeholders when present
if [[ -f "$DOCS" ]]; then
  perl -i -pe "s/USDC SAC contract ID from Circle.*\n  - \*\*Record here after resolution:\*\* \`_{10,}\`/USDC SAC (Stellar Asset Contract):\n  - \*\*Contract ID:\*\* \`$USDC_SAC\`/ if \$ENV{first}" "$DOCS" 2>/dev/null || true
  perl -i -pe "s/\*\*Record here after resolution:\*\* \`_{10,}\`/\*\*Contract ID:\*\* \`$USDC_SAC\`/" "$DOCS" 2>/dev/null || true
  if grep -q "DISBURSEMENT_WALLET_WASM_HASH" "$DOCS" 2>/dev/null; then
    perl -i -pe "s/DISBURSEMENT_WALLET_WASM_HASH=.*/DISBURSEMENT_WALLET_WASM_HASH=$WASM_HASH/" "$DOCS" 2>/dev/null || true
  else
    cat >> "$DOCS" <<EOF

## Shared WASM (testnet)

- **DISBURSEMENT_WALLET_WASM_HASH:** \`$WASM_HASH\`
- Per-org contract instances are deployed at onboarding via \`POST /api/profile/org/provision-treasury\`.
EOF
  fi
  echo "Updated $DOCS"
fi

echo "Done. Per-org disbursement contracts deploy automatically during NGO onboarding."
