#!/usr/bin/env bash
# Adds the KnowX help pages to an EmDash site. Run from the site's root folder (see the install guide):
#   kit="$(mktemp -d)" &&
#     git clone --depth 1 \
#       --branch v<version> \
#       https://github.com/wbcomdesigns/emdash-knowx \
#       "$kit/emdash-knowx" &&
#     "$kit/emdash-knowx/scripts/add-to-site.sh" .
# Safe to run again after a plugin update. It replaces KnowX's own files, never replaces a newer
# shared file another Wbcom plugin copied, never touches src/layouts/KnowXLayout.astro once it
# exists, and keeps a dated backup of the wording file only when you edited it yourself.
set -euo pipefail

PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$PLUGIN/site-kit"
QUIET=0
[[ "${2:-}" == "--quiet" ]] && QUIET=1
if [[ -z "${1:-}" || ! -d "$1" ]]; then
	echo "Usage: $0 /path/to/your/site   (use . from the site's root folder)" >&2
	exit 1
fi
SITE="$(cd "$1" && pwd)"

if ! ls "$SITE"/astro.config.* >/dev/null 2>&1 || ! grep -q "emdash" "$SITE"/astro.config.* || [[ ! -d "$SITE/src" ]]; then
	echo "$SITE is not an EmDash site (no astro.config that loads emdash, or no src/ folder). Nothing was copied." >&2
	exit 1
fi

VERSION="$(node -e 'console.log(require(process.argv[1]).version)' "$PLUGIN/package.json")"
SUMS="$KIT/lib/knowx-strings.sums"
notes=()

# Line 1 of each shared file carries "wbcom-shared: N". A copy without the number counts as 0.
shared_version() { local v; v="$(sed -n '1s/.*wbcom-shared: *\([0-9]*\).*/\1/p' "$1" 2>/dev/null)"; echo "${v:-0}"; }

copy() { # copy <kit file> <site file>
	local from="$1" to="$2" name
	name="$(basename "$from")"
	mkdir -p "$(dirname "$to")"
	if [[ "$name" == wbcom-kit.ts || "$name" == wbcom-base.css ]] && [[ -f "$to" ]]; then
		local have want
		have="$(shared_version "$to")"
		want="$(shared_version "$from")"
		if (( want < have )); then
			notes+=("Kept your newer ${to#"$SITE/"} (wbcom-shared $have, this kit has $want).")
			return
		fi
		(( want > have )) && notes+=("Upgraded ${to#"$SITE/"} from wbcom-shared $have to $want (another Wbcom plugin had copied the older one).")
	fi
	# knowx-strings.sums lists the SHA-256 of the file at every release: a file whose hash is in
	# it was never edited, so it is replaced quietly. Only an edited file is backed up.
	if [[ "$name" == knowx-strings.ts && -f "$to" ]] && ! cmp -s "$from" "$to"; then
		local sum backup
		sum="$(shasum -a 256 "$to" | cut -d' ' -f1)"
		if ! grep -qx "$sum" "$SUMS"; then
			backup="$to.bak-$(date +%Y%m%d)"
			[[ -e "$backup" ]] && backup="$to.bak-$(date +%Y%m%d-%H%M%S)"
			cp "$to" "$backup"
			notes+=("You had edited ${to#"$SITE/"}. Your version is saved as ${backup#"$SITE/"}: copy your wording back from it.")
		fi
	fi
	cp "$from" "$to"
}

for part in lib styles components; do
	for file in "$KIT/$part"/*; do
		[[ -f "$file" && "$(basename "$file")" != .gitkeep && "$file" != *.sums ]] && copy "$file" "$SITE/src/$part/$(basename "$file")"
	done
done
while IFS= read -r file; do
	copy "$file" "$SITE/src/pages/${file#"$KIT/pages/"}"
done < <(find "$KIT/pages" -type f -name '*.astro')

layout="$SITE/src/layouts/KnowXLayout.astro"
layout_note="(yours, left as it is)"
if [[ ! -f "$layout" ]]; then
	mkdir -p "$SITE/src/layouts"
	cp "$KIT/layouts/KnowXLayout.astro" "$layout"
	layout_note="(new)"
fi

mkdir -p "$SITE/.emdash"
cp "$KIT/seed/knowx-seed.json" "$SITE/.emdash/knowx-seed.json"

# Create the content types when the site keeps its database in a local SQLite file and Node can
# run the seed. The seed skips anything that already exists and never changes your menus.
db="$(sed -n 's/.*url:[[:space:]]*"file:\([^"]*\)".*/\1/p' "$SITE"/astro.config.* 2>/dev/null | head -n 1 || true)"
node_ok="$(node -e 'const [a,b]=process.versions.node.split(".").map(Number);console.log(a>22||(a===22&&b>=16)?1:0)')"
seeded="no"
if [[ -n "$db" && "$node_ok" == 1 && "$QUIET" == 0 ]]; then
	if (cd "$SITE" && npx --yes emdash seed .emdash/knowx-seed.json --no-content -d "$db" >/dev/null 2>&1); then
		seeded="yes"
	fi
fi

[[ "$QUIET" == 1 ]] && exit 0

for note in "${notes[@]+"${notes[@]}"}"; do echo "Note: $note"; done
cat <<DONE
KnowX $VERSION site kit copied into $SITE

  Pages    src/pages/docs/ (help home, articles, topics, search, FAQ)
  Parts    src/components/Helpful.astro, StillNeedHelp.astro, DocSearch.astro
  Code     src/lib/knowx.ts, knowx-icons.ts, knowx-products.ts, wbcom-kit.ts
  Styles   src/styles/knowx.css, wbcom-base.css
  Wording  src/lib/knowx-strings.ts (reword or translate here)
  Layout   src/layouts/KnowXLayout.astro $layout_note
  Seed     .emdash/knowx-seed.json (the Help articles and FAQs content types)

DONE
if [[ "$seeded" == "yes" ]]; then
	echo "  Content types: Help articles and FAQs are ready (the seed ran on ${db#./})."
else
	cat <<DONE
  Content types: run this once (Node 22.16 or later; it skips anything that already exists):
      cd "$SITE" && npx emdash seed .emdash/knowx-seed.json --no-content
  Add -d <file> if your database is not ./data.db. On a hosted database, create them in the
  admin instead: Content Types, New, slugs "docs" and "faq" (the install guide lists the fields).
DONE
fi
cat <<DONE

Left for you:

  1. Open src/layouts/KnowXLayout.astro. If your site's layout is not
     src/layouts/Base.astro taking title and description, point it at yours.
  2. Optional: a help search box on every post. In src/pages/posts/[slug].astro add
       import DocSearch from "../../components/DocSearch.astro";
     to the top block, and <DocSearch /> on the line after
       <PortableText value={post.data.content} />
     so the box sits under the post text, inside the post column.
  3. Stop the dev server and start it again.
  4. In the admin, Menus: add Help linking to /docs/ and FAQ linking to /docs/faq/.
  5. In the admin, Content, Help articles: add and publish your first article.
     Content, FAQs: add your first question. Then open /docs/ and /docs/faq/.

After each plugin update, run this from the site root with the new version's tag:

  kit="\$(mktemp -d)" &&
    git clone --depth 1 \\
      --branch v<new version> \\
      https://github.com/wbcomdesigns/emdash-knowx \\
      "\$kit/emdash-knowx" &&
    "\$kit/emdash-knowx/scripts/add-to-site.sh" .

Guide: https://github.com/wbcomdesigns/emdash-knowx/blob/v$VERSION/docs/website/getting-started/install.md
DONE
