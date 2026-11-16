## 0.2.3

No new permission. Copy the kit again.

- Fix      - Members below admin see a plain "Only site admins" page, not a raw error.
- Fix      - The help home lists every article, ten at a time with More articles.
- Fix      - Search results go on past 20 with More results.
- Fix      - On a phone, On this page comes before the article.
- Fix      - Yes or No stays marked after a reload.
- Fix      - Copy link buttons name their heading.

## 0.2.2

No new permission. The site kit did not change.

- Improve  - The registry checks the site runs EmDash 1.2.0 or later before installing.
- Fix      - A single FAQ page no longer carries incomplete FAQ structured data.

## 0.2.1

After updating from 0.1.x, Insights shows its upgrade progress until it is done.

- Fix      - Insights no longer shows "None yet" while votes from 0.1.x are still being brought over.
- Fix      - A Yes or No click before the page script loads is kept and sent. Copy the kit again.

Older versions: https://github.com/wbcomdesigns/emdash-knowx/blob/main/CHANGELOG.md

To copy the kit for this version, from your site's root folder:

```bash
kit="$(mktemp -d)" &&
  git -c advice.detachedHead=false \
    clone --depth 1 --branch v0.2.3 \
    https://github.com/wbcomdesigns/emdash-knowx \
    "$kit/emdash-knowx" &&
  "$kit/emdash-knowx/scripts/add-to-site.sh" .
```
