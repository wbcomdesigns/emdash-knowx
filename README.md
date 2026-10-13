# KnowX Knowledge Base for EmDash

A searchable knowledge base for EmDash: categories, article feedback, and a report of what readers search for.

Status: in development. Not published.

- Scope and schema: [SCOPE.md](SCOPE.md)
- Plan and decisions: [PLAN.md](PLAN.md)
- State of the work: [ops/handoff.md](ops/handoff.md)
- How to build and release: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release cases: [docs/qa/QA_CHECKLIST.md](docs/qa/QA_CHECKLIST.md)

The plugin is the engine. An EmDash plugin cannot add pages to a site, so the visible parts ship as a site kit in `site-kit/` that the owner copies in once.
