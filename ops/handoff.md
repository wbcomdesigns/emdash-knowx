# Handoff: KnowX (2026-10-20, 0.2.0 published, 0.2.1 in review)

You are the one agent for this repo. Read this, then work.

## Read first, in this order

1. Load the `emdash-plugin-development` skill.
2. EmDash's own guides in a lab site: `.agents/skills/building-emdash-site` and `.agents/skills/creating-plugins`.
3. `~/code/emdash-plugin-starter/EMDASH-SUPPORT.md`.
4. `SCOPE.md` here. The corrections section wins over older lines.
5. `PLAN.md` here.

## Where it stands

**Live:** `@vapvarun.bsky.social/knowx@0.1.1` on `main`, tag `v0.1.1`. Merged from PR 21.

- Registry release URI: `at://did:plc:2o6axbe264shvyedyhycyhya/com.emdashcms.experimental.package.release/knowx:0.1.1`
- Public page after listing check: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/knowx
- GitHub release: https://github.com/wbcomdesigns/emdash-knowx/releases/tag/v0.1.1
- Lab: `../emdash-lab-knowx` on port 4333.

0.1.1 covers team issues #22-#29 (shared kit + registry id, banner and shots, theme column, long search wrap, copy-link hover, one labelled search, Settings tabs, Insights stats and chart). Site owners must copy `site-kit/` again after they update.

`#17` (in-text block) was dropped: a sandboxed registry package cannot ship `portableTextBlocks`.

## 0.2.1 (branch `0.2.1`, milestone 0.2.1)

Not merged, tagged or published.

- #52: after 0.1.5 to 0.2.0 Insights showed "None yet" on the first loads. Cause: a step that found nothing to do (no `day:` keys; or no vote rows left while titles were still to name) returned `worked: false`, so the page rendered from records not yet brought over. Fix in `src/upgrade.ts`: the first load looks for 0.1.x data (`day:` keys, a vote row with no `commented`); none stores `done` and renders the page, some stores setting `upgrade_0_2 = { started: true }` and shows the card. After that every load shows the card until `upgradeDone`. Test: `tests/release-0-2-1.test.ts` (small lab-shaped seed, with and without day keys, and a site that began on 0.2.0).
- #51: `site-kit/components/Helpful.astro` has an inline script that keeps a Yes or No click made before the kit script binds (button gets `aria-busy`); the kit script sends it once after wiring. Kit changed: owners copy it again.
- #50 (rate:* kv keys never removed) left open: no bounded cleanup fits a small step (kv list is unbounded, one delete per call). Needs its own design.
- Budget: new site first load 9 (unchanged) and its second load now 6 (was 9); every other entry unchanged.

Still to do before publish: Sonnet re-check of #52 on the Node lab (registry 0.1.5 small seed, update to this build, open Insights repeatedly) and #51 on the Cloudflare testbed, independent Opus review of `git diff v0.2.0..0.2.1`, owner's publish call. "Cloudflare: not supported yet" stays.

## 0.2.0 (published 2026-10-20, issue #48, milestone 0.2.0)

Fits Cloudflare's 10 requests per plugin call. Not merged, tagged or published. What changed:

- New storage `article_votes` (per-article yes, no, net, title) and `stats` (one `site` record: vote totals and a 16-day search ring). Writes use `updateIf` deltas in the same call as the vote or search; no retry loops anywhere (`src/core.ts` `spend()` budget).
- `feedback` rows gain `title` and `commented` (indexed) for Recent comments.
- Settings read with one `ctx.settings.list`. `kit_pages_done` moved from kv "1" to a setting holding the version (the card comes back after each update, like WB Polls).
- New admin page `/searches` (Top searches, Searches with no results). Insights keeps stats, chart, least helpful, comments.
- 0.1.x data comes over a step per Insights load (`src/upgrade.ts`: days, votes, titles; state in kv `state:upgrade_0_2`, each step claimed with a compare-and-set before it writes, so a double click or two tabs count once; setting `upgrade_0_2` = `{ done: true }` when finished).
- `tests/bridge-budget.test.ts`: every entry pinned, all 9 or fewer, KNOWN_OVER empty. `tests/release-0-2-0.test.ts`: 0.1.5-shaped upgrade, unpublished vote refused, setup card wording, kit done sticks.
- Kit unchanged: the 0.1.5 kit works on the 0.2.0 engine and the other way round.

Still to do before publish: Sonnet walk of QA C-1 to C-8 on the Cloudflare testbed (plugin from a `file:` or registry install of this branch) and the Node lab, independent Opus review of `git diff v0.1.5..0.2.0`, owner's publish call. The install line "Cloudflare: not supported yet" stays until the owner changes it after that walk.

## Next

- 0.1.4 is live (2026-10-15): help pages read their settings and log searches inside EmDash, with no web request.
- No open issues. A registry release cannot be changed: file a new milestone for anything after 0.1.4.

## How to work

- GitHub issues only. Never Basecamp.
- No AI attribution. No em-dashes.
- Branch named for the version. One PR into main.
