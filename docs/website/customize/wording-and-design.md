# Wording and design

**Included in Free.** KnowX has no paid version.

## Change the words visitors see

Every phrase on the help pages lives in one file your developer copied: `src/lib/knowx-strings.ts`. Change a phrase there and rebuild the site. This is also how you translate the help pages.

## Fit the pages into your design

Every help page is wrapped in `src/layouts/KnowXLayout.astro`, which hands the page to your site's own layout. It expects `src/layouts/Base.astro` taking a `title` and a `description`, which is what the EmDash templates ship. If your layout has a different name or props, change that one file. No other help page needs editing, and a kit update never replaces it.

## Colours and dark mode

The help pages take their colours and fonts from your site's theme, and follow the visitor's light or dark setting. To change the help pages' look only, edit `src/styles/knowx.css`; its rules only apply inside the help pages.

## Several Wbcom plugins on one site

KnowX works alone or next to any other Wbcom plugin. They share two small files (`wbcom-kit.ts` and `wbcom-base.css`); keep the copy with the higher number on its first line.
