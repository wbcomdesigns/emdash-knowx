# Handoff: KnowX Knowledge Base

Read this first. Then `SCOPE.md`, `AGENTS.md`, `CONTRIBUTING.md` and `docs/qa/QA_CHECKLIST.md`.

## Where it stands (2026-10-13)

Starter only. Nothing built.

| Thing | Where |
| --- | --- |
| Repo | `wbcomdesigns/emdash-knowx`, local `~/code/emdash-knowx` |
| Registry package | `@vapvarun.bsky.social/knowx` (not published) |
| Lab site | `~/code/emdash-lab-knowx`, port 4333 |
| Cards | GitHub issues in this repo, milestone `0.1.0` |
| Reference plugin | `~/code/emdash-listora` (shipped), `~/code/emdash-reviews` (same starter, engine built) |
| Shared starter | `~/code/emdash-plugin-starter` |

## Start

```bash
cd ~/code/emdash-knowx
npm install --legacy-peer-deps
npm test
./scripts/setup-lab.sh
./scripts/reset-lab.sh
```

## Cards, in order

1. Schema, manifest and the docs collection
2. Search route and search log
3. Was this helpful
4. Kit pages: home and category
5. Kit page: article
6. Search box and results page
7. Admin insights
8. Lab, prove script, owner docs
9. Registry branding and release gate

Each card lists what to build, when it is UX ready, when it is function ready, and the QA cases that prove it. A card is done when all three hold and you have commented on it with what you verified and how. Take them in order: later cards assume earlier ones.

## Decisions already made

- Free scope only. `SCOPE.md` lists what is in and what is out.
- Members sign in with their EmDash account. Guests can do only what `SCOPE.md` marks public.
- Kit markup is the same for every visitor, because site pages are cached without regard to cookies.
- The owner publishes. Agents stop at a passing gate and hand over.

## Watch for

- Search reads published articles and filters in the plugin. Fine for a few hundred articles. Confirm `ctx.content.list` limits and whether a `where` on searchable text exists before choosing the approach
- `helpful` and `search` are public writes. Rate limit per IP, cap lengths, and never echo a logged term into admin HTML unescaped
- `requestMeta.ip` may be empty on some hosts. Then every visitor shares one vote bucket: decide and document the fallback
- The search log must not store personal data. Drop terms that look like an email address or a long number
- Kit pages must not import starter-only files. Take the layout as a prop or document the one import to change
- Article pages are cached. The helpful widget and its counts load in the browser

## When you stop

Rewrite "Where it stands" with the date and the truth: what works, what was verified and how, what was not verified. Update `docs/qa/QA_CHECKLIST.md`'s last-walk line the same way.
