#!/usr/bin/env bash
# Build and deploy testnet PizzaToken (SEP-41, 0 decimals, premint 20 to owner).
#
# Prerequisites:
#   - stellar CLI
#   - STELLAR_FUNDER_SECRET in environment or .env.local (Friendbot-funded G account)
#
# Usage:
#   ./scripts/deploy-pizza-token-testnet.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE="$ROOT/contracts/pizza_token"
RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

if [[ -f "$ROOT/.env.local" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    [[ "$line" == *"="* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key// /}"
    case "$key" in
      STELLAR_FUNDER_SECRET|SOROBAN_RPC_URL)
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

OWNER="$(cd "$ROOT" && node --input-type=module -e "import { Keypair } from '@stellar/stellar-sdk'; console.log(Keypair.fromSecret(process.env.STELLAR_FUNDER_SECRET).publicKey());")"
echo "Owner / premint recipient: $OWNER"

echo "Building pizza_token WASM…"
(cd "$CRATE" && stellar contract build)

WASM=""
if [[ -f "$CRATE/target/wasm32v1-none/release/pizza_token.wasm" ]]; then
  WASM="$CRATE/target/wasm32v1-none/release/pizza_token.wasm"
elif [[ -f "$CRATE/target/wasm32-unknown-unknown/release/pizza_token.wasm" ]]; then
  WASM="$CRATE/target/wasm32-unknown-unknown/release/pizza_token.wasm"
fi
if [[ -z "$WASM" ]]; then
  echo "ERROR: pizza_token.wasm not found after build." >&2
  find "$CRATE/target" -name 'pizza_token.wasm' || true
  exit 1
fi
echo "WASM: $WASM"

echo "Deploying PizzaToken to testnet (premint 20)…"
DEPLOY_OUT="$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$STELLAR_FUNDER_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- \
  --recipient "$OWNER" \
  --owner "$OWNER" 2>&1)"
echo "$DEPLOY_OUT"

CONTRACT_ID="$(echo "$DEPLOY_OUT" | grep -Eo 'C[A-Z0-9]{55}' | tail -1)"
if [[ -z "$CONTRACT_ID" ]]; then
  echo "ERROR: Could not parse PizzaToken contract id from deploy output." >&2
  exit 1
fi

echo ""
echo "=== Add to .env.local ==="
echo "SOROBAN_PIZZA_TOKEN_ID=$CONTRACT_ID"
echo ""
echo "Record in docs/02-contracts/testnet-contracts.md next to Circle USDC."
echo "Owner (benfranklin funder) received premint 20 PIZZA: $OWNER"
