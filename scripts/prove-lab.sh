#!/usr/bin/env bash
# Route-level smoke on the running lab. Add one check per route as you build it.
set -euo pipefail
source "$(dirname "$0")/lab-env.sh"
API="$BASE/_emdash/api/plugins/$SLUG"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "PASS: $1"; }
json() { curl -sf -H "X-EmDash-Request: 1" -H "Origin: $BASE" "$@"; }
status() { curl -s -o /dev/null -w "%{http_code}" -H "X-EmDash-Request: 1" -H "Origin: $BASE" "$@"; }

json "$API/health" | grep -q '"ok":true' || fail "health"
ok "health"

# Member and admin routes must refuse guests. List every such route here.
for route in ${GUEST_REFUSED_ROUTES:-}; do
	[[ "$(status "$API/$route")" == "401" ]] || fail "guest refused on $route"
done
ok "guests refused on member and admin routes"

JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
curl -sf -c "$JAR" -o /dev/null "$BASE/_emdash/api/setup/dev-bypass?redirect=/"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/insights"}' "$API/admin")" == "200" ]] || fail "admin insights page loads"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/settings"}' "$API/admin")" == "200" ]] || fail "admin settings page loads"
ok "admin pages load"

# plugin-specific checks go below this line
HEALTH="$(json "$API/health")"
echo "$HEALTH" | grep -q '"collectionExists":true' || fail "docs collection exists"
echo "$HEALTH" | grep -q '"faqCollectionExists":true' || fail "faq collection exists"
echo "$HEALTH" | grep -q '"articleCount":[1-9]' || fail "published article count"
ok "collections and article count"
echo "$HEALTH" >/dev/null
PRODUCTS="$(json "$API/products")"
echo "$PRODUCTS" | grep -q '"productLayer":true' || fail "product layer for three categories"
echo "$PRODUCTS" | grep -q 'Getting started' || fail "product names"
ok "products"

echo "All checks passed for $SLUG"
