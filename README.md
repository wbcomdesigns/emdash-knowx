# KnowX Knowledge Base for EmDash

A searchable knowledge base for EmDash: categories, article feedback, and a report of what readers search for.

The plugin is the engine. An EmDash plugin cannot add pages to a site, so the visible parts ship as a site kit in `site-kit/` that the owner copies in once.

## Stand up a help center

1. Install the plugin and confirm the three read permissions.
2. Copy the kit. Steps: [site-kit/README.md](site-kit/README.md).
3. Create the `docs` and `faq` collections from `site-kit/seed/`, with search on.
4. Add menu links for `/docs/` and `/docs/faq/`.
5. Open Admin, KnowX, Settings. Set a contact link and tick what search covers.

On this repo's lab:

```bash
npm install --legacy-peer-deps
./scripts/setup-lab.sh
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```

## Docs

- Scope and schema: [SCOPE.md](SCOPE.md)
- Plan and decisions: [PLAN.md](PLAN.md)
- How to build and release: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release cases: [docs/qa/QA_CHECKLIST.md](docs/qa/QA_CHECKLIST.md)
- State of the work: [ops/handoff.md](ops/handoff.md)
