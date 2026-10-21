#!/usr/bin/env bash
# One-command production deploy to Vercel.
#
#   VERCEL_TOKEN=xxx WEATHERAPI_KEY=yyy ./deploy.sh
#
# Secrets are read from the environment only; nothing is written to disk.
set -euo pipefail

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN to your Vercel access token}"
: "${WEATHERAPI_KEY:?Set WEATHERAPI_KEY to your WeatherAPI key}"
PROJECT="${PROJECT_NAME:-cred-weather}"
VERCEL="npx --yes vercel@latest"
cd "$(dirname "$0")"

echo "› Linking project \"$PROJECT\""
$VERCEL link --yes --project "$PROJECT" --token "$VERCEL_TOKEN" >/dev/null

echo "› Setting WEATHERAPI_KEY (server-side environment variable)"
for env in production development; do
  $VERCEL env rm WEATHERAPI_KEY "$env" --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$WEATHERAPI_KEY" | $VERCEL env add WEATHERAPI_KEY "$env" --token "$VERCEL_TOKEN" >/dev/null
done

echo "› Deploying to production"
LOG="$(mktemp)"
DEPLOY_URL="$($VERCEL deploy --prod --yes --token "$VERCEL_TOKEN" 2>"$LOG")"
PROD_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' "$LOG" | grep -v "$(basename "$DEPLOY_URL")" | tail -1 || true)"
rm -f "$LOG"
URL="${PROD_URL:-https://$PROJECT.vercel.app}"

echo "› Smoke test: $URL/api/weather?city=Patna"
STATUS="$(curl -s -o /tmp/weather-smoke.json -w '%{http_code}' "$URL/api/weather?city=Patna" || true)"
if [ "$STATUS" = "200" ] && grep -q '"current"' /tmp/weather-smoke.json; then
  echo "  ✓ API proxy returned live weather"
  if grep -q "$WEATHERAPI_KEY" /tmp/weather-smoke.json; then echo "  ✗ key leaked in response!"; exit 1; fi
else
  echo "  ! Got HTTP $STATUS. If 401, Vercel deployment protection is on; open the URL in a browser."
fi
rm -f /tmp/weather-smoke.json

echo
echo "Production:  $URL"
echo "Deployment:  $DEPLOY_URL"
