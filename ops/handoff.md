# Handoff: KnowX (2026-10-14, 0.1.0 ready for the owner to publish)

You are the one agent for this repo. Read this, then work.

## Read first, in this order

1. Load the `emdash-plugin-development` skill. It separates what EmDash core already gives every site, what a plugin may add, and the owner's standing rules.
2. EmDash's own guides in the lab site: `.agents/skills/building-emdash-site` and `.agents/skills/creating-plugins` (with `references/sandbox-boundaries.md`). They win over everything else.
3. `~/code/emdash-plugin-starter/EMDASH-SUPPORT.md`: what is proven, what is documented but not tried, what is not possible.
4. `SCOPE.md` here. Start with its section "Corrections after reading EmDash's own guides": it wins over older lines.
5. `PLAN.md` here.

## Where it stands

Branch `0.1.0`, pull request https://github.com/wbcomdesigns/emdash-knowx/pull/18. The local lab at `../emdash-lab-knowx` (port 4333) is a working help center.

0.1.0 cards are done except the owner publish step. `#17` (in-text block) is dropped for this release: `emdash-plugin build` cannot ship `portableTextBlocks` in a sandboxed registry package. The registry install is the whole product without it.

## The gate

`npm test` (13 tests), `npm run build`, `./scripts/reset-lab.sh`, `./scripts/prove-lab.sh`, and a browser walk as guest, subscriber and admin are done. `npm run bundle` is 22.8 KB / 4 files. Do not merge, tag or publish. The owner publishes after the security review of the last pushed commit.

## How to work

- Never Basecamp. GitHub issues only.
- No AI attribution. No em-dashes.
- A registry release cannot be changed. The owner releases.

## You stop when

The owner has published. An agent never merges into `main`, never tags, never runs `emdash-plugin publish`.
