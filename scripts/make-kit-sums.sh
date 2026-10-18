#!/usr/bin/env bash
# Writes site-kit/kit.sums: "<sha256>  <path>" for every kit file add-to-site.sh copies, at every
# released tag and in the working tree. add-to-site.sh backs up a site file only when its hash is
# not listed for that path, so files the owner never edited are replaced quietly.
# Run before each release (the gate test checks the working tree is listed).
set -euo pipefail
PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN"
kit_files() { # <tree-ish or ""> -> paths under site-kit/ that the script copies (shared files excluded)
	if [[ -n "$1" ]]; then git ls-tree -r --name-only "$1" -- site-kit; else git ls-files site-kit; find site-kit -type f; fi |
		sed -n 's#^site-kit/##p' | grep -E '^(lib/[^/]+\.ts|styles/[^/]+\.css|components/[^/]+\.astro|layouts/[^/]+\.astro|pages/.+\.astro)$' |
		grep -vE '(^|/)wbcom-(kit\.ts|base\.css)$' | sort -u
}
{
	for tag in $(git tag --list 'v*' --sort=v:refname); do
		while IFS= read -r path; do
			printf '%s  %s\n' "$(git show "${tag}:site-kit/${path}" | shasum -a 256 | cut -d' ' -f1)" "$path"
		done < <(kit_files "$tag")
	done
	while IFS= read -r path; do
		printf '%s  %s\n' "$(shasum -a 256 "site-kit/$path" | cut -d' ' -f1)" "$path"
	done < <(kit_files "")
} | awk '!seen[$0]++' > site-kit/kit.sums
echo "Wrote site-kit/kit.sums ($(wc -l < site-kit/kit.sums | tr -d ' ') lines)"
