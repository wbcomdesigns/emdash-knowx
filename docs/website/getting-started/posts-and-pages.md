# Posts and pages

**Included in Free.** KnowX has no paid version.

KnowX brings its own help pages. They sit next to your blog posts and pages, and you link between them. This guide assumes the standard EmDash blog template (`npm create emdash@latest -- --template blog`).

## The pages it adds

| Page | Address |
| --- | --- |
| Help home | `/docs/` |
| One help article | `/docs/<slug>/` |
| One topic | `/docs/category/<topic>/` |
| Search results | `/docs/search` |
| FAQ | `/docs/faq/` |

Your posts stay at `/posts/<slug>` and your pages at `/pages/<slug>`. Nothing about them changes.

## Add the pages to your menu

1. In admin, open **Menus**.
2. Add a link named **Help** that points to `/docs/`.
3. Add a link named **FAQ** that points to `/docs/faq/`.

## Link to a help article from a post or page

Use a normal link. In the post or page editor, select the words, add a link, and paste the article's address.

For example, a post about a new feature can say "Read the [setup guide](/docs/setup-guide/)". Use `/docs/category/<topic>/` to link to a whole topic. You find the slug on the article in **Help articles**.

## Show blog posts in help search

Help search can look through your posts and pages too.

1. Open **KnowX**, then **Settings**, then **Search**.
2. Tick **Posts**. You can tick up to five content types.
3. In **Content Types**, make sure search is turned on for each one.

Post results link to `/posts/<slug>`. Each result says what kind of content it is.

Page results link to `/<slug>`. The blog template keeps pages at `/pages/<slug>`, so those links will not open there. Tick **Pages** only if your pages live at `/<slug>`.

## Put the help search box on a post or page

The site kit has a component for this. It is for your developer to add to the template. Registry plugins cannot add blocks inside the text you write in the editor, so this goes in the template file.

In `src/pages/posts/[slug].astro` (or `src/pages/pages/[slug].astro`), add the import in the top block:

```astro
import DocSearch from "../../components/DocSearch.astro";
```

Then place the tag where you want the box:

```astro
<DocSearch />
```

It searches your help articles by default. To search posts as well, pass the types: `<DocSearch collections={["docs", "posts"]} />`. Search must be on for those types in **Content Types**.

The kit also has `StillNeedHelp`, which draws the contact button. Pass it your contact address: `<StillNeedHelp href="/contact" />`. It does not read the **Contact link** setting, so keep the two in step.

## Was this helpful works on help articles only

The kit's `Helpful` component takes an id, and on a help article it is `entry.data.id`. KnowX checks that the id belongs to a published help article. If you place it on a post with `post.data.id`, the votes are refused and nothing is counted. Votes and Insights cover help articles only.

On the blog template, `post.id` is the post's slug, not its id. Use `post.data.id` for any component that asks for an id.

## Next step

[Use cases](use-cases.md).
