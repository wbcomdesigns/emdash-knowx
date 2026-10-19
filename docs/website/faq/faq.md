# Frequently asked questions

**Included in Free.** KnowX has no paid version.

## Why is `/docs/` a 404 after install?

The plugin cannot create pages. Run the two kit lines from [Install](../getting-started/install.md), step 2, then restart the dev server. KnowX, Insights shows the same lines for the version you installed.

## Do visitors need an account?

Not to search, read or use the contact button. Voting **Was this helpful** works for guests when the host gives EmDash the visitor's address (Cloudflare, or `trustedProxyHeaders` in `astro.config.mjs`). On other hosts guests see a sign-in link instead, and signed-in members vote. See [Guests and visitor addresses](../getting-started/install.md#guests-and-visitor-addresses).

## Can search include my blog posts or pages?

Yes. Tick them in **Settings**, **Search** (up to five content types), and make sure search is turned on for them in **Content Types**.

## Does KnowX send email?

No. The contact button is a link you set: a page, a web address or an email address.

## Does KnowX store who voted or searched?

No names and no internet addresses. Votes keep a scrambled code only to stop repeat votes. The search log keeps the words, not who typed them.

## Can I put a search box inside a blog post?

Not inside the text you write in the editor: EmDash does not let registry plugins add blocks there. Your developer can add the help search to the post template so it shows on every post. See [Use it on blog posts and pages](../getting-started/posts-and-pages.md).

## Is there a changelog page?

Not in KnowX. The Product Roadmap plugin has one.

## Does it work in dark mode and on phones?

Yes.

## Is there a paid version?

No. Everything in these guides is free.
