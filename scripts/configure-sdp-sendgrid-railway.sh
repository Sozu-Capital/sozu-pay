#!/usr/bin/env bash
# Configure SDP on Railway to send real OTP / invitation emails via SendGrid (free tier).
#
# SDP uses EMAIL_SENDER_TYPE=TWILIO_EMAIL (SendGrid API — no Twilio SMS account required).
#
# Usage:
#   ./scripts/configure-sdp-sendgrid-railway.sh <SENDGRID_API_KEY> <verified_sender_email>
#
# Example:
#   ./scripts/configure-sdp-sendgrid-railway.sh SG.xxxx inboxblessedux@gmail.com
#
# Prerequisites:
#   - railway CLI linked to your SDP project (railway link)
#   - SendGrid account with a verified Single Sender matching <verified_sender_email>
#   - Service name defaults to sdp-v2 (override with SDP_RAILWAY_SERVICE)

set -euo pipefail

API_KEY="${1:-}"
SENDER_EMAIL="${2:-}"
SERVICE="${SDP_RAILWAY_SERVICE:-sdp-v2}"

if [[ -z "$API_KEY" || -z "$SENDER_EMAIL" ]]; then
  echo "Usage: $0 <SENDGRID_API_KEY> <verified_sender_email>" >&2
  echo "See docs/04-integrations/sdp-railway-deploy.md → Step 7b" >&2
  exit 1
fi

if [[ ! "$SENDER_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  echo "Error: sender must be a plain email (SDP validates with ValidateEmail, no display name)." >&2
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Error: railway CLI not found. Install: npm install -g @railway/cli" >&2
  exit 1
fi

echo "Setting email vars on Railway service: $SERVICE"
railway variables set \
  "EMAIL_SENDER_TYPE=TWILIO_EMAIL" \
  "TWILIO_SENDGRID_API_KEY=${API_KEY}" \
  "TWILIO_SENDGRID_SENDER_ADDRESS=${SENDER_EMAIL}" \
  --service "$SERVICE"

echo "Redeploying $SERVICE..."
railway redeploy --service "$SERVICE" -y

echo ""
echo "Done. Test OTP:"
echo "  1. Open wallet-registration on SDP"
echo "  2. Enter the batch recipient email (must match disbursement row)"
echo "  3. Request OTP — check inbox (and SendGrid Activity feed if missing)"
echo ""
echo "Invite emails from SozuPay dashboard still use Resend (separate config on Vercel)."
