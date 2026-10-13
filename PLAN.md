# Plan: KnowX Knowledge Base

**Status: LOCKED on 2026-10-13.** Scope and decisions were agreed with the owner. An agent does not add options or features. If a task cannot be done as written, stop, say why on its issue, and wait for the owner.

The plan for this plugin, kept in the repository so it travels with the code. `SCOPE.md` says what the plugin is. This file says in what order it gets built and what waits.

## Decisions made with the owner

| Question | Decision |
| --- | --- |
| When a reader finds no answer | Offer a contact link. The owner sets one contact page or email in settings. |
| What search looks through | The owner picks. Help articles by default, plus any other content they add. |
| Wording and language | One wording file per plugin kit. Every visitor-facing phrase lives there, so an owner can translate or reword the plugin by editing one file. |
| Several products | Yes. Top-level categories are products, shown as cards with an icon and a description. One top-level category means no product layer. |
| Article page extras | Section tree, copy-link on headings, copy button on code, last updated date, Ctrl or Cmd + K for search. |
| FAQ | Yes, its own page, with FAQ data for search engines. |
| Versions | An optional "Applies to version" badge on an article. No changelog page here: Roadmap has one. |
| Search engine data | Articles and breadcrumbs. |
| Choosing what search covers | Tick-boxes of the site's real content types. |
| Setup and long lists | Developer guide plus one command. Next, Previous and find in admin. |

## 0.1.0: first release

Work the cards in this order. Each is a GitHub issue under milestone `0.1.0` with its build list, UX bar, function bar and QA cases. Later cards assume earlier ones.

1. **Schema, manifest and the docs collection**. Proven by: tests
2. **Search route and search log**. Proven by: G-1, G-2, G-3
3. **Was this helpful**. Proven by: G-4, G-5, G-6
4. **Kit pages: home and category**. Proven by: G-7, G-8, P-1, P-2, P-3, P-4
5. **Kit page: article**. Proven by: G-9, G-10, P-5
6. **Search box and results page**. Proven by: G-11, G-12
7. **Admin insights**. Proven by: A-1, A-2, A-3, A-4
8. **Still need help: contact link**. Proven by: G-13, G-14, A-5
9. **Search across the owner's chosen content**. Proven by: G-15
10. **Wording file**. Proven by: G-92
11. **Lab, prove script, owner docs**. Proven by: tests
12. **Registry branding and release gate**. Proven by: the whole checklist

0.1.0 is done when every card is closed with a verification comment, `docs/qa/QA_CHECKLIST.md` has an honest last-walk line, and the gate in `CONTRIBUTING.md` passes. The owner publishes.

## 0.2.0: parked on purpose

Agreed as worth doing, not now. Do not start these during 0.1.0.

- Restricting articles to members
- Article view counts
- A built-in question form

## Not planned

See "Out of scope" in `SCOPE.md`. If a card seems to need one of those, stop and ask the owner.

## Before it goes on a live site

- Prove the kit on a preview deploy of one existing site, never on production first
- Check the site's EmDash version, its content security policy, and its page cache against what the kit does
- Findings from the first plugin are in `wbcomdesigns/emdash-listora` issue #23

## Added after the owner review and the WordPress comparison (2026-10-13)

Work the original steps in order, with these placed as follows: #16 settings page (right after the schema step), #13 products (before the home and category pages), #14 article page extras (with the article page step), #15 FAQ (after the article page), #17 in-text block (prove first, before the wording file).

One agent works this repo, in order, on a branch named `0.1.0`, opens a pull request into `main` and stops. It never merges, tags or publishes. Guest writes here (helpful votes, comments after a No, the search log) are public: copy the compare-and-set rate limit and guarded writes from `emdash-listora`.
