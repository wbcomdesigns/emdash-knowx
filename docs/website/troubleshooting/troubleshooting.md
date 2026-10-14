# Troubleshooting

**Included in Free.** KnowX has no paid version.

## `/docs/` shows a 404

The site kit pages are not in the site. Copy them from the kit (see [Install](../getting-started/install.md)), then rebuild.

## The help home says help articles are not set up

The **Help articles** collection does not exist, or has another address. Create it with `site-kit/seed/collection.mjs` or by hand (see [Install](../getting-started/install.md#step-2-create-the-help-collections)).

## Search finds nothing

1. Is the content type ticked in **Settings**, **Search**?
2. Is search turned on for that type in **Content Types**?
3. Is the article published? Drafts are not searched.

## Votes or the search log do not save after an update

Copy the site kit again from the version you installed. An older kit may not reach a newer plugin.

## The "Still need help?" button does not show

Set a contact link in **Settings**, **Still need help**. It shows only after an empty search or a No vote.

## The help pages do not look like the rest of my site

Check `src/layouts/KnowXLayout.astro` points at your site's layout. See [Wording and design](../customize/wording-and-design.md).

## Insights is empty

Insights fills as visitors search and vote. On a new site, search and vote once yourself in a private window, then reload Insights.
