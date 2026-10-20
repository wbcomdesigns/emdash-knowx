## 0.2.1

After updating from 0.1.x, Insights shows its upgrade progress until it is done.

- Fix      - Insights no longer shows "None yet" while votes from 0.1.x are still being brought over.
- Fix      - A Yes or No click before the page script loads is kept and sent. Copy the kit again.

## 0.2.0

Every help page, vote, search and admin screen now fits Cloudflare's limit of 10 requests per plugin call.

- New      - Each article keeps running Yes and No counts, updated with the vote.
- New      - A Searches screen holds Top searches and Searches with no results.
- New      - Data from 0.1.x is brought over a step at a time as Insights opens.
- Improve  - Was this helpful answers clicks at once and shows the vote is being sent. Copy the kit again.
- Fix      - On Cloudflare a vote no longer shows "Something went wrong" after it was saved.
- Fix      - On Cloudflare Insights, Settings and their actions no longer fail on a busy site.
- Fix      - The setup card says where to create the content types on a site without SQLite.

## 0.1.5

- Security: guests vote and searches are counted only when the host gives EmDash the visitor's address; elsewhere guests sign in to vote. Search log capped at 5000 terms.
- New: one command copies the kit and creates the content types. Insights shows a Set up visitor pages card, and Top searches has find and paging.
- Fix: Insights counts every search and vote; help pages line up with the theme frame; dark mode buttons pass 4.5:1.

Older versions: https://github.com/wbcomdesigns/emdash-knowx/blob/main/CHANGELOG.md

To copy the kit for this version, from your site's root folder:

```bash
kit="$(mktemp -d)" &&
  git clone --depth 1 \
    --branch v0.2.1 \
    https://github.com/wbcomdesigns/emdash-knowx \
    "$kit/emdash-knowx" &&
  "$kit/emdash-knowx/scripts/add-to-site.sh" .
```
