# Handoff: KnowX (2026-10-14, 0.1.1 published)

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

## Next

A registry release cannot be changed. File a new milestone for anything after 0.1.1. Patch only if a site owner is exposed.

Never merge, tag or publish unless the owner asks.

## How to work

- GitHub issues only. Never Basecamp.
- No AI attribution. No em-dashes.
- Branch named for the version. One PR into main.
