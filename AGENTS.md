# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Layout

```
apps/viewer/        Next.js 16 app (React 19 + Three.js/R3F + Zustand) — static export, no SSR
packages/schema/    Zod schemas + parseDocument() — the authoritative data contract
packages/analyzer/  Static code analysis → AnalysisGraph (runs entirely in-process, no DB)
packages/bridge/    WebSocket bridge + headless Bob Shell runner
packages/grounding/ Citation validator (graph ↔ Bob documents)
packages/scrubber/  PII scrubber for recordings before publication
packages/stream/    NDJSON parser + Recording builder
demo/shopfloor/     Intentional-bug demo app — DO NOT fix bugs unless a task explicitly asks
worlds/             One directory per deployable world (world.json + committed Bob documents)
```

## Commands

```
npm run dev           # builds data then starts viewer on :3000
npm run data          # regenerates apps/viewer/public/data/ from worlds/ (must re-run after world changes)
npm test              # vitest run (packages + scripts + viewer unit tests)
npm run test:demo     # runs demo/shopfloor tests only
npm run typecheck     # tsc across all packages + viewer
npm run lint          # eslint across all packages
npm run verify        # typecheck + lint + test + guard (full CI gate)
npm run bridge        # live WebSocket bridge for local viewer (starts Bob Shell)
npm run analyze       # CLI: tsx packages/analyzer/src/cli.ts
npm run scrub         # CLI: redact PII from a .codeverse/raw/*.ndjson before committing
```

**Run a single test file:**
```
npx vitest run packages/schema/test/schema.test.ts
```

Test files live in `packages/*/test/**/*.test.ts`, `scripts/test/**/*.test.ts`, and `apps/viewer/src/**/*.test.ts` (not in a separate top-level `__tests__` folder).

## Data Pipeline

`npm run data` runs `scripts/build-data.ts` which:
1. Reads `worlds/*/world.json` for config
2. Calls `analyze()` to produce a fresh `AnalysisGraph` for each world
3. Validates and copies committed Bob documents (semantic/tour/investigation/recording)
4. In dev/CI (not `--public`): fills gaps in `shopfloor` world with synthetic fixtures from `packages/grounding/test/fixtures/` and `packages/stream/test/fixtures/`
5. Writes everything to `apps/viewer/public/data/` (gitignored)

`npm run build` runs `check:public` before building: all synthetic data, unscrubbed recordings, and non-Bob content are blocked from the production bundle.

## Schema Contracts (`packages/schema`)

All documents share `schemaVersion: 1` and a `kind` discriminant:

| kind | type | written by |
|---|---|---|
| `codeverse.graph` | `AnalysisGraph` | `@codeverse/analyzer` |
| `codeverse.semantic` | `SemanticLayer` | `/codeverse-scan` Bob skill |
| `codeverse.investigation` | `Investigation` | `/codeverse-investigate` Bob skill |
| `codeverse.tour` | `Tour` | `/codeverse-tour` Bob skill |
| `codeverse.recording` | `Recording` | `@codeverse/stream` via bridge |
| `codeverse.worlds` | `WorldIndex` | `scripts/build-data.ts` |

Use `parseDocument(text)` from `@codeverse/schema` to parse any document — it validates size, JSON, and schema.  
`RelPath` rejects absolute paths, backslashes, drive letters, and `..` — always use POSIX repo-relative paths in citations.

## Code Style

- **TypeScript strict mode** with `noUncheckedIndexedAccess` — array/record access returns `T | undefined`
- `no-explicit-any` is an **error** — use `unknown` and narrow, or define a type
- Unused vars prefixed with `_` are allowed; all others are errors
- No `eval`, `new Function`, or implied eval anywhere
- All packages are `"type": "module"` — ESM only, no CommonJS
- Packages export raw `.ts` source (e.g. `"exports": { ".": "./src/index.ts" }`) — transpiled by the consumer
- Zod schemas follow the pattern: define schema → export type with same name via `z.infer<typeof Schema>`

## Guard / Commit Rules

`scripts/guard.mjs` (runs as a pre-commit hook and in CI) blocks:
- Paths starting with `private/`, `bob-prompts/`, `.codeverse/`, `apps/viewer/public/data/`
- Any `.md`/`.mdx` file except `README.md`, `AGENTS.md`, `bob_sessions/`, `.bob/`
- Env files, secrets, and personal terms (username/email/home path)
- `"synthetic": true` anywhere inside `worlds/`
- `bob_sessions/` files other than PNGs and `.gitkeep`

## Adding a New World

1. Create `worlds/<id>/world.json` with `id`, `title`, `description`, `target`, optional `skip[]`
2. Re-run `npm run data` to generate the graph
3. Commit Bob documents (semantic/tour/investigation) alongside `world.json`
4. Recordings must be scrubbed (`npm run scrub`) before committing

## Key Non-Obvious Details

- `apps/viewer` is a **static export** (`output: 'export'` in `next.config.ts`); `reactStrictMode: false` is intentional
- `@codeverse/schema`, `@codeverse/stream`, `@codeverse/grounding` must be in `transpilePackages` in `next.config.ts` — they export raw TS
- Service node IDs are prefixed `svc:` (e.g. `svc:packages/analyzer`); file node IDs are bare repo-relative POSIX paths
- `demo/shopfloor` contains an **intentional bug** (SSO checkout fails) used for Bob investigation demos — do not fix it
- `CODEVERSE_BOB_BIN` env var overrides Bob Shell detection in the bridge (useful for CI/alternate installs)
- Node 24.x required (`.nvmrc` pins `24.21.0`)
