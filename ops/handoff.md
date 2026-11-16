# Handoff: KnowX (2026-11-16)

Live: **0.2.2** on the EmDash registry as `@vapvarun.bsky.social/knowx`. Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/knowx

Test on a fresh `create-emdash` blog site (registry install, kit from the release tag) and on the Cloudflare test site. On Cloudflare, redeploy after a registry install or update before judging anything (emdash-cms/emdash#4865).

## 0.2.3 (branch `0.2.3`, PR open, not merged, tagged or published)

Fixed, each with a test in `tests/release-0-2-3.test.ts`:

- #63 Members below admin got a raw 403 on KnowX admin pages. EmDash lists plugin admin pages to every role and answers a route with no permission with its own 403. The `admin` route now admits members (`permission: content:read`) and answers anyone below admin (role 50) with an "Only site admins can use KnowX" page before any read. The menu entries still show: that is EmDash core.
- #64 Help home Articles list: newest ten with More articles (cursor paging) instead of a fixed 8. Search results also page past 20 with More results; only the first page logs the search.
- #65 On this page is first in the markup: above the article on a phone, beside it on wide screens, first in tab order.
- #66 Yes or No stays marked after a reload (browser storage, per viewer).
- #67 Copy link buttons are named "Copy link: <heading>".
- #61 Shared kit files at wbcom-shared 5 and wbcom-kit 6; registry Installation text has the Cloudflare redeploy line; the kit command clones the tag with `git -c advice.detachedHead=false` (still six lines of 52 or fewer).
- Docs: the product card description comes from Help categories, the icon from Settings (QA query; the code already did this).

Not fixed, commented on each issue with the reason: #50 (needs a recurring task, a minor), #54 (one call over the new-site budget, and it heals itself through tally), #56 (needs a minor by its own text), #57 (one call over the new-site Insights budget).

Still to do: independent walk on Node and Cloudflare, owner's publish call.

## How to work

- GitHub issues only. Never Basecamp.
- No AI attribution. No em-dashes.
- Branch named for the version. One PR into main.
