# AGENTS.md — Ask mode

This file provides guidance to agents when working with code in this repository.

## Key Context for Questions

- `apps/viewer/public/data/` is **generated at build time** — it does not exist in the repo and must not be committed.
- The "shopfloor" world exposes an intentional bug; bug reports about SSO checkout failure in `demo/shopfloor/` are expected, not defects to fix.
- `packages/schema` is the single source of truth for all data contracts — the Zod schemas are the spec, not the docs.
- `worlds/<id>/world.json` configures a world; committed Bob documents (semantic/tour/investigation/recording) live alongside it. The `target` field is a repo-relative path, not a URL.
- `synthetic: true` documents (fixtures used in local dev/CI) must never appear inside `worlds/` — they are only in `packages/*/test/fixtures/`.
- The bridge (`npm run bridge`) requires Bob Shell to be installed and reachable — set `CODEVERSE_BOB_BIN` to override auto-detection.
- `apps/viewer` transpiles `@codeverse/schema`, `@codeverse/stream`, and `@codeverse/grounding` directly from TypeScript source — there is no compiled output in `dist/`.
- Guard rules: only `README.md`, `AGENTS.md`, `bob_sessions/` PNGs, and `.bob/` Markdown may be committed; everything else in `private/`, `bob-prompts/`, `.codeverse/`, and `apps/viewer/public/data/` is blocked.
