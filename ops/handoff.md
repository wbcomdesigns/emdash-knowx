# Handoff: KnowX (2026-11-15)

Live: **0.2.2** on the EmDash registry as `@vapvarun.bsky.social/knowx`. Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/knowx

Test on a fresh `create-emdash` blog site (registry install, kit from the release tag) and on the Cloudflare test site. On Cloudflare, redeploy after a registry install or update before judging anything (emdash-cms/emdash#4865).

## Next: 0.2.3

Milestone `0.2.3` on GitHub holds the work, in this order:

- #50 rate:* kv keys are never removed
- #54 A site mid-upgrade on 0.2.0 with only commented old votes can skip the titles step
- #56 Composite storage indexes for filtered and sorted queries
- #57 Move internal state from settings to kv
- #61 Next release: registry install text and shared kit

Then the release gate (`gate.sh`, which also checks that no public file carries machine paths and that the README is the product landing page), an independent walk on Node and Cloudflare, and publish only with the owner's go-ahead.

## How to work

- GitHub issues only. Never Basecamp.
- No AI attribution. No em-dashes.
- Branch named for the version. One PR into main.
