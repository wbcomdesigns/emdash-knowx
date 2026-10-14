# Install KnowX

**Included in Free.** KnowX has no paid version.

Installing has three parts: the plugin in admin, two content collections, and the site kit in your site's code. The last two need someone who can edit the site's files.

## Before you start

- Your site runs EmDash 1.2 or later, with a sandbox runner in `astro.config.mjs` (sites made with `npm create emdash@latest` from 1.2 have one).
- No page on your site uses the address `/docs`. The help pages would hide it; rename it first.

## Step 1: install the plugin

1. In admin, open **Plugins**, then **Registry**, search for **KnowX** and choose **Install**.
2. EmDash lists what KnowX asks for: reading your content, your content types and your categories. It never changes your content. Confirm the install.

A **KnowX** group with **Insights** and **Settings** appears in the admin menu.

## Step 2: create the help collections

KnowX reads two collections:

| Collection | Fields | Used for |
| --- | --- | --- |
| Help articles (`docs`) | Title, Excerpt, Content, Applies to version | Articles |
| FAQs (`faq`) | Question, Answer | The FAQ page |

plus a **Help categories** taxonomy for topics. The kit includes a script that creates all of them with search turned on: `site-kit/seed/collection.mjs` (and `site-kit/seed/articles.mjs` for sample articles). Or create them by hand in **Content Types** with the same fields, and turn search on for both.

## Step 3: copy the site kit

The kit is in `site-kit/` of the [KnowX repository](https://github.com/wbcomdesigns/emdash-knowx), at the tag of the version you installed. The [kit guide](https://github.com/wbcomdesigns/emdash-knowx/blob/main/site-kit/README.md) lists every file to copy. It adds the pages `/docs/`, `/docs/search`, `/docs/faq/`, each article and each topic.

Two files, `wbcom-kit.ts` and `wbcom-base.css`, are shared by every Wbcom plugin. If another Wbcom plugin already copied them, keep the newer copy: the first line of each carries a number (`wbcom-shared: N`), and the kit guide's copy step checks it for you.

The help pages wrap themselves in your site's own layout through one file, `src/layouts/KnowXLayout.astro`. See [Wording and design](../customize/wording-and-design.md) if your layout is not `src/layouts/Base.astro`.

## Step 4: menu and settings

1. In **Menus**, add **Help** linking to `/docs/` and **FAQ** linking to `/docs/faq/`.
2. Open **KnowX**, then **Settings**. Set a contact link if you want the "Still need help?" button, and tick the content types search should cover.

## Check it worked

Open `/docs/` on your site. You see the search box and your topics. If you see a 404, the kit pages were not copied; see [Troubleshooting](../troubleshooting/troubleshooting.md).

## After you update the plugin

Copy the kit again from the new version's tag.
