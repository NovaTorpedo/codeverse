# AGENTS.md — Agent (coding) mode

This file provides guidance to agents when working with code in this repository.

## Critical Coding Rules

- **Never fix bugs in `demo/shopfloor/`** unless the task explicitly asks — the SSO/checkout bug is intentional for demos.
- All packages export raw `.ts` via `"exports": { ".": "./src/index.ts" }` — do not add a build step or compile to `dist/`.
- `noUncheckedIndexedAccess` is enabled — every array/record access returns `T | undefined`; narrow before use.
- `@typescript-eslint/no-explicit-any` is an error — use `unknown` + type narrowing.
- Schema types follow `const Foo = z.object(…); type Foo = z.infer<typeof Foo>` — export both with the same name.
- `RelPath` in `packages/schema/src/common.ts` rejects absolute paths, backslashes, drive letters, `..` — citations must use forward-slash repo-relative paths.
- To add a new world: create `worlds/<id>/world.json`, run `npm run data`, commit Bob documents alongside it. The data directory (`apps/viewer/public/data/`) is gitignored and rebuilt at build time.
- Recordings committed to `worlds/` must first be scrubbed (`npm run scrub`) — `check:public` will block the build otherwise.
- After changing any package consumed by the viewer, run `npm run data` before `npm run dev` to see changes.
- `apps/viewer` is a static Next.js export — no server-side APIs, no `getServerSideProps`, no Node built-ins in React components.
- New packages added to the viewer's workspace deps that export raw TS must be added to `transpilePackages` in `apps/viewer/next.config.ts`.
- Service node IDs use the `svc:` prefix (e.g. `svc:packages/analyzer`); file node IDs are bare POSIX paths relative to the repo root.
- `scripts/guard.mjs` blocks committing Markdown outside the allow-list — only `README.md`, `AGENTS.md`, `bob_sessions/`, and `.bob/` are permitted.
