# Use cases

**Included in Free.** KnowX has no paid version.

Here are five ways site owners use KnowX. Each one says which settings to pick and what visitors then see. Settings are on **KnowX**, then **Settings**, in admin.

## Run a help center for one product

You sell one product or service, and customers keep asking the same questions.

1. Open **Help categories** and add a few topics, for example **Getting started** and **Account and billing**. Give each a short description, because it shows on the topic card.
2. Open **Help articles**, choose **Add New**, write a **Title**, the **Content** and a short **Excerpt**, pick a topic and publish.
3. In Admin, **Menus**, add **Help** linking to `/docs/`.

Visitors open `/docs/` and see a search box, your topic cards and a list of articles. Each article has a table of contents when it has three or more headings, previous and next links, and the last updated date. See [Help home, topics and articles](../features/help-pages.md).

## Write product docs by topic

You sell several products and each needs its own docs.

1. Make each product a top-level help category. Put its topics under it.
2. Open **Settings**, then **Product icons**, and pick an icon for each product.
3. If an article only fits one release, fill in **Applies to version**, for example `2.4`.

With more than one top-level category, the help home shows one card per product, with its name, description and icon. Each topic has its own page at `/docs/category/<topic>/`. Articles with a version show it as a badge.

## Add an FAQ page

You want short answers to the questions people ask most, in one place.

1. Open **FAQs**, choose **Add New**, write the **Question** and the **Answer**, and publish.
2. In Admin, **Menus**, add **FAQ** linking to `/docs/faq/`.

Visitors see every published FAQ, sorted by question from A to Z. Each question opens to show its answer. The first answer is open when the page loads. The page also carries question-and-answer data, so search engines can show your FAQs in results. See [The FAQ page](../features/faq-page.md).

## Ask "Was this helpful?" and offer a way out

You want to know whether an article worked, and give unhappy readers a next step.

1. Under **Settings**, then **Feedback**, leave **Ask for a comment after a No vote** on. Turn it off if you only want the vote.
2. Under **Still need help**, enter a **Contact link**. It can be a page like `/contact`, a web address, or `mailto:help@example.com`.

Every article ends with **Yes** and **No**. After a **No**, the reader can write up to 500 characters about what was missing. Then a **Still need help?** button leads to your contact link. The same button shows after a search that finds nothing. Leave the link empty to hide it. KnowX does not send email itself. See [Was this helpful and Still need help](../features/feedback.md).

## Find out what to write next with Insights

You want to spend your time on the articles that matter.

1. Open **KnowX**, then **Searches** once a week.
2. Read **Searches with no results**. These are things people wanted and did not find. Write an article, or add the word to an existing one.
3. Open **Insights** and read **Least helpful articles**. These have more No votes than Yes votes. Rewrite them, then read **Recent comments** for the missing detail.
4. On **Searches**, use **Top searches** to check that each popular word has a good article.

The EmDash dashboard also shows a KnowX card with empty searches this week and the least helpful article. Insights counts words only, never who searched. See [Insights](../features/insights.md).

If you want blog posts in the results too, tick them under **Settings**, then **Search**. Search must be turned on for them in **Content Types**.

## Next step

[Use it with posts and pages](posts-and-pages.md).
