# Troubleshooting

**Included in Free.** KnowX has no paid version.

## `/docs/` shows a 404

The site kit pages are not in the site. Run the two kit lines from [Install](../getting-started/install.md), step 2, then stop the dev server and start it again.

## The help home says help articles are not set up

The **Help articles** content type does not exist, or has another address. Run `npx emdash seed .emdash/knowx-seed.json --no-content` from the site root with Node 22.16 or later (`add-to-site.sh` writes that file), or create it by hand (see [Install](../getting-started/install.md#what-each-step-does-for-knowx)).

## Search finds nothing

1. Is the content type ticked in **Settings**, **Search**?
2. Is search turned on for that type in **Content Types**?
3. Is the article published? Drafts are not searched.

## Votes or the search log do not save after an update

Copy the site kit again from the version you installed. An older kit may not reach a newer plugin.

## Guests see "Sign in to say whether this helped"

The host does not give EmDash the visitor's address, so KnowX cannot limit guests and asks them to sign in. Guest searches are not counted on Insights either. Run the site on Cloudflare, or set `trustedProxyHeaders` (see [Guests and visitor addresses](../getting-started/install.md#guests-and-visitor-addresses)).

## The "Still need help?" button does not show

Set a contact link in **Settings**, **Still need help**. It shows only after an empty search or a No vote.

## The help pages do not look like the rest of my site

Check `src/layouts/KnowXLayout.astro` points at your site's layout. See [Wording and design](../customize/wording-and-design.md).

## Insights is empty

Insights fills as visitors search and vote. On a new site, search and vote once yourself in a private window, then reload Insights. Search terms are on **KnowX, Searches**.

## Insights says "Bringing over data from KnowX 0.1"

The site was updated from 0.1.x. Votes and search counts from before the update are counted a step at a time, about 100 votes each time Insights opens. Press **Continue** until it says **Insights is ready**. See [Insights](../features/insights.md#after-updating-from-01x).

## The help home or a category shows no content types after the kit was copied

On a site whose database is not a local SQLite file (Cloudflare D1, for example) the kit cannot create the content types. Create them in the admin: [Install](../getting-started/install.md#create-the-content-types-in-the-admin).

## Help and FAQ both look selected in the menu on the FAQ page

That is your theme, not KnowX. The EmDash blog template marks a menu link as current when the page address starts with the link's address, and `/docs/faq/` starts with `/docs/`. To change it, edit how your layout picks the current menu item.
