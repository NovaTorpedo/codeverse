# AGENTS.md — Plan mode

This file provides guidance to agents when working with code in this repository.

## Architectural Constraints

- **Analyzer is deterministic and stateless** — `analyze()` in `packages/analyzer/src/analyze.ts` runs in-process with no DB or network. All graph data is derived fresh at build time from source files. Do not introduce caching or persistence inside the analyzer.
- **Grounding is read-only** — `ground()` in `packages/grounding/src/index.ts` validates Bob documents against the graph but never writes. The score is advisory; it is not enforced by the schema.
- **Static viewer, no SSR** — `apps/viewer` uses `output: 'export'`. Any feature requiring a server must go through the bridge (`packages/bridge`), not the viewer.
- **Data pipeline is one-way** — `scripts/build-data.ts` reads `worlds/` and writes to `apps/viewer/public/data/`. Nothing in the viewer writes back to worlds.
- **Production gate is strict** — `scripts/check-public-data.ts` (runs in `npm run build`) blocks any synthetic, unscrubbed, or schema-invalid documents from shipping. Plan features that produce new document types around this gate.
- **Schema versioning** — `SCHEMA_VERSION = 1` is a literal used in every document. Changing it requires updating all producers and consumers simultaneously; avoid if possible.
- **`demo/shopfloor` is frozen by design** — its intentional SSO/checkout bug is the primary demo scenario. Any plan that touches `demo/shopfloor` source must explicitly call this out as "intentional breakage" or it will be blocked.
- **Bridge token model** — the bridge issues a one-time session token embedded in a hash URL (`#live=<port>.<token>`). Tokens are not stored; the bridge must stay running for the session duration. Multi-user or persistent sessions are out of scope.
- **Package exports are raw TS** — the monorepo relies on consumers (Next.js, vitest) transpiling packages directly. Any plan to publish packages externally must account for a separate build step.
