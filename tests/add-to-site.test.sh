#!/usr/bin/env bash
# Checks scripts/add-to-site.sh on throwaway sites (run by npm test; vitest runs inside workerd, with no shell).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/add-to-site.sh"
KIT="$ROOT/site-kit"
fail() { echo "FAIL add-to-site: $1" >&2; exit 1; }
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
new_site() {
	site="$work/$1"; mkdir -p "$site/src/lib" "$site/src/styles" "$site/src/components"
	echo 'import emdash from "emdash/astro";' > "$site/astro.config.mjs"
}

# A folder that is not an EmDash site gets nothing.
mkdir -p "$work/plain/src"
"$SCRIPT" "$work/plain" >/dev/null 2>&1 && fail "accepted a folder that is not an EmDash site"
[[ -z "$(find "$work/plain/src" -type f)" ]] || fail "copied files into a folder that is not an EmDash site"

# First run on a site with an untouched 0.2.0 kit: replaced quietly, layout and seed added.
new_site old
git -C "$ROOT" show v0.2.0:site-kit/components/Helpful.astro > "$site/src/components/Helpful.astro"
git -C "$ROOT" show v0.2.0:site-kit/lib/knowx-strings.ts > "$site/src/lib/knowx-strings.ts"
out="$("$SCRIPT" "$site")"
[[ "$out" != *"You had edited"* ]] || fail "backed up untouched 0.2.0 files"
find "$site" -name '*.bak-*' | grep -q . && fail "left a backup of an untouched file"
cmp -s "$site/src/components/Helpful.astro" "$KIT/components/Helpful.astro" || fail "did not replace the old Helpful.astro"
for f in pages/docs/index.astro pages/docs/faq/index.astro "pages/docs/[...slug].astro" lib/knowx.ts styles/knowx.css; do
	cmp -s "$site/src/$f" "$KIT/$f" || fail "did not copy $f"
done
cmp -s "$site/src/layouts/KnowXLayout.astro" "$KIT/layouts/KnowXLayout.astro" || fail "did not add the layout"
[[ -f "$site/.emdash/knowx-seed.json" ]] || fail "did not copy the seed"
grep -q "KnowXLayout.astro (new)" <<<"$out" || fail "did not say the layout is new"

# Second run: the owner's layout is left alone, an edited wording file is backed up with their text.
echo "<!-- mine -->" > "$site/src/layouts/KnowXLayout.astro"
echo "export const kx = { faqTitle: 'Fragen' };" > "$site/src/lib/knowx-strings.ts"
out="$("$SCRIPT" "$site")"
[[ "$(cat "$site/src/layouts/KnowXLayout.astro")" == "<!-- mine -->" ]] || fail "replaced the owner's layout"
grep -q "KnowXLayout.astro (yours, left as it is)" <<<"$out" || fail "did not say the layout was kept"
grep -q "src/lib/knowx-strings.ts.bak-" <<<"$out" || fail "did not list the wording backup"
grep -q "Fragen" "$site"/src/lib/knowx-strings.ts.bak-* || fail "backup does not hold the owner's wording"
cmp -s "$site/src/lib/knowx-strings.ts" "$KIT/lib/knowx-strings.ts" || fail "did not install the new wording file"

# Shared files: an older copy from another plugin is upgraded, a newer one is kept.
new_site shared
printf '/* wbcom-shared: 1 */\n' > "$site/src/styles/wbcom-base.css"
printf '/* wbcom-shared: 99 */\n' > "$site/src/lib/wbcom-kit.ts"
out="$("$SCRIPT" "$site")"
grep -q "Upgraded src/styles/wbcom-base.css from wbcom-shared 1 to" <<<"$out" || fail "did not announce the shared CSS upgrade"
cmp -s "$site/src/styles/wbcom-base.css" "$KIT/styles/wbcom-base.css" || fail "did not upgrade the older shared CSS"
grep -q "Kept your newer src/lib/wbcom-kit.ts (wbcom-shared 99" <<<"$out" || fail "did not say it kept the newer shared kit file"
[[ "$(head -n 1 "$site/src/lib/wbcom-kit.ts")" == "/* wbcom-shared: 99 */" ]] || fail "replaced a newer shared file"
find "$site" -name '*.bak-*' | grep -q . && fail "backed up a shared file"

echo "add-to-site.sh: all checks passed"
