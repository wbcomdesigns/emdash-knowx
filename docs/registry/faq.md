**Why is `/docs/` a 404 after install?**
The plugin cannot create pages. Run the two kit lines from the Installation tab, then restart the dev server.

**Votes or search log fail after a registry install?**
Copy the current site kit. Older kits called `/plugins/knowx/` only. A registry install uses a generated id. The current kit tries that id, then the name.

**Can guests vote and search?**
Search and reading, always. Voting, when the host gives EmDash the visitor's address (Cloudflare, or `trustedProxyHeaders`); elsewhere guests see a sign-in link and members vote.

**Does search look through posts and pages?**
Only the content types you tick on Settings. Help articles are on by default. A type with search turned off in its collection will not return results.

**Does it send email?**
No. The contact button is a link you set: a page, an http(s) address, or a mailto address.

**Does it work in dark mode?**
Yes. The kit colours follow your site theme.

**Is there a paid version?**
No. Everything here is free.

**Can I put a search box inside an article?**
Not from the registry install. That needs a trusted install, and it is not part of this release.
