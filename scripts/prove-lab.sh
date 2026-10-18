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
for route in ${GUEST_REFUSED_ROUTES:-helpful_member admin}; do
	[[ "$(status -X POST -H 'Content-Type: application/json' -d '{}' "$API/$route")" == "401" ]] || fail "guest refused on $route"
done
ok "guests refused on member and admin routes"

JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
curl -sf -c "$JAR" -o /dev/null "$BASE/_emdash/api/setup/dev-bypass?redirect=/"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/insights"}' "$API/admin")" == "200" ]] || fail "admin insights page loads"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/settings"}' "$API/admin")" == "200" ]] || fail "admin settings page loads"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"widget":"insights"}' "$API/admin")" == "200" ]] || fail "admin dashboard card loads"
ok "admin pages load"

# plugin-specific checks go below this line
HEALTH="$(json "$API/health")"
grep -q '"collectionExists":true' <<<"$HEALTH" || fail "docs collection exists"
grep -q '"faqCollectionExists":true' <<<"$HEALTH" || fail "faq collection exists"
grep -q '"articleCount":[1-9]' <<<"$HEALTH" || fail "published article count"
ok "collections and article count"
echo "$HEALTH" >/dev/null
PRODUCTS="$(json "$API/products")"
grep -q '"productLayer":true' <<<"$PRODUCTS" || fail "product layer for three categories"
grep -q 'Getting started' <<<"$PRODUCTS" || fail "product names"
ok "products"

CONFIG="$(json "$API/config")"
grep -q '"ok":true' <<<"$CONFIG" || fail "config"
grep -q 'searchCollections' <<<"$CONFIG" || fail "config search collections"
ok "config"

# The lab trusts X-Forwarded-For (wire-lab.mjs), so a guest with that header has an address.
GUEST=(-H "X-Forwarded-For: 203.0.113.7")
NOIP="$(json -X POST -H 'Content-Type: application/json' -d '{"q":"welcome","found":1}' "$API/log_search")"
grep -q 'GUEST_UNAVAILABLE' <<<"$NOIP" || fail "guest search with no visitor address is refused"
ok "guest writes refused with no visitor address"
LOG="$(json "${GUEST[@]}" -X POST -H 'Content-Type: application/json' -d '{"q":"welcome","found":1}' "$API/log_search")"
grep -q '"ok":true' <<<"$LOG" || fail "log_search"
ok "log_search"

DOC_ID="$(curl -sf "$BASE/docs/welcome-to-the-help-center" | sed -n 's/.*data-kx-helpful data-id="\([^"]*\)".*/\1/p' | head -n 1)"
[[ -n "$DOC_ID" ]] || fail "article page is missing the helpful widget"
HELPFUL="$(json "${GUEST[@]}" -X POST -H 'Content-Type: application/json' -d "{\"id\":\"$DOC_ID\",\"helpful\":false,\"comment\":\"Need more steps\"}" "$API/helpful")"
grep -q '"ok":true' <<<"$HELPFUL" || fail "helpful"
grep -q '"no":' <<<"$HELPFUL" || fail "helpful tally"
ok "helpful"
INSIGHTS="$(json -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/insights"}' "$API/admin")"
grep -q 'Need more steps' <<<"$INSIGHTS" || fail "insights comment"
grep -qi 'Welcome' <<<"$INSIGHTS" || fail "insights article name"
ok "insights after a vote and a search"

for path in /docs /docs/search /docs/faq /docs/category/getting-started /docs/category/getting-started/first-week /docs/welcome-to-the-help-center; do
	code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")"
	[[ "$code" == "200" ]] || fail "page $path returned $code"
done
ok "help pages"

MISSING="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/docs/this-article-is-not-here")"
[[ "$MISSING" == "404" ]] || fail "missing article should be 404, got $MISSING"
ok "missing article is 404"

SEARCH_PAGE="$(curl -sf "$BASE/docs/search?q=welcome")"
grep -qi "Welcome" <<<"$SEARCH_PAGE" || fail "search page finds a help article"
grep -q "Help article" <<<"$SEARCH_PAGE" || fail "search page labels a help article"
grep -q "How this help center is organised" <<<"$SEARCH_PAGE" || fail "search hit shows the article excerpt, not a repeated title"
ok "search page finds and labels help articles"

SAVE_SEARCH="$(json -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"form_submit","action_id":"save_search","page":"/settings","values":{"search_collections":["docs","posts"]}}' "$API/admin")"
grep -q '"type":"success"' <<<"$SAVE_SEARCH" || fail "save search coverage"
COVERED="$(json "$API/config")"
grep -q '"posts"' <<<"$COVERED" || fail "config includes posts after save"
ok "search coverage includes posts when listed"

echo "All checks passed for $SLUG"
