#!/usr/bin/env bash
# SDP preflight checks before testnet E2E (local terminal).
set -euo pipefail

PROD_DOMAIN="${1:-credit.sozu.capital}"
SDP_API_CONTAINER="${SDP_API_CONTAINER:-sdp-sdp-api-1}"
SDP_DB_CONTAINER="${SDP_DB_CONTAINER:-sdp-db-1}"
DISBURSEMENT_ID="${DISBURSEMENT_ID:-}"

echo "== SozuCredit TOML (production domain) =="
URL="https://${PROD_DOMAIN}/.well-known/stellar.toml"
HTTP_CODE=$(curl -sS -o /tmp/sdp-toml.txt -w "%{http_code}" "$URL" || true)
echo "GET $URL → HTTP $HTTP_CODE"
head -5 /tmp/sdp-toml.txt || true
if grep -q "SEP10_CLIENT_SIGNING_SECRET is not set" /tmp/sdp-toml.txt 2>/dev/null; then
  echo "FAIL: Set SEP10_CLIENT_SIGNING_SECRET on Vercel and redeploy."
  exit 1
fi
if ! grep -q 'SIGNING_KEY="G' /tmp/sdp-toml.txt 2>/dev/null; then
  echo "FAIL: TOML missing SIGNING_KEY"
  exit 1
fi
echo "OK: TOML looks valid"

if docker ps --format '{{.Names}}' | grep -q "^${SDP_API_CONTAINER}$"; then
  echo ""
  echo "== SDP API container → wallet TOML =="
  if docker exec "$SDP_API_CONTAINER" wget -qO- "https://${PROD_DOMAIN}/.well-known/stellar.toml" 2>/dev/null | head -3; then
    echo "OK: sdp-api can fetch wallet TOML"
  else
    echo "WARN: sdp-api could not fetch TOML (check Docker network / TLS)"
  fi
else
  echo "SKIP: $SDP_API_CONTAINER not running"
fi

if [[ -n "$DISBURSEMENT_ID" ]] && docker ps --format '{{.Names}}' | grep -q "^${SDP_DB_CONTAINER}$"; then
  echo ""
  echo "== Payment tx hashes for disbursement $DISBURSEMENT_ID =="
  docker exec "$SDP_DB_CONTAINER" psql -U postgres -d sdp_mtn -c "
SELECT r.external_id, p.amount, p.status, p.stellar_transaction_id
FROM sdp_bluecorp.payments p
JOIN sdp_bluecorp.receivers r ON r.id = p.receiver_id
WHERE p.disbursement_id = '${DISBURSEMENT_ID}'
ORDER BY r.external_id;
"
fi

echo ""
echo "Done. Next: resend SDP invites, complete registration on https://${PROD_DOMAIN}, then re-run with DISBURSEMENT_ID set."
