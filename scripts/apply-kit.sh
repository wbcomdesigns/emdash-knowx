#!/usr/bin/env bash
# Copy the site kit into the lab with the same script a site owner runs (add-to-site.sh).
set -euo pipefail
source "$(dirname "$0")/lab-env.sh"
[[ -d "$LAB/src" ]] || { echo "Lab not found at $LAB. Run scripts/setup-lab.sh first." >&2; exit 1; }
"$PLUGIN/scripts/add-to-site.sh" "$LAB" --quiet
# Lab-only pages that mount the components for a browser walk.
if [[ -d "$PLUGIN/site-kit/lab" ]]; then
	mkdir -p "$LAB/src/pages"
	find "$PLUGIN/site-kit/lab" -type f ! -name .gitkeep -exec cp {} "$LAB/src/pages/" \;
fi
echo "Copied site-kit into $LAB"
