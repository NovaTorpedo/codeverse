# CodeVerse Project Rules

- `demo/shopfloor` contains a known, intentional bug used for Bob investigation demos. Do not fix it unless the current task explicitly asks you to.
- Never read or write `private/`, `bob-prompts/` (except files the user @-mentions), `.env*`, or `.codeverse/raw/`.
- Never add credentials, API keys, tokens, email addresses or personal paths to any file.
- Keep code comments minimal and functional. Match the surrounding code style: TypeScript, 2-space indent, single quotes.
- Test commands: `npm test` (all packages), `npm run test:demo` (Shopfloor only), `npm run verify` (typecheck + lint + tests + repo guard).
- Commit messages: short, imperative, plain English (example: `add guided tour player`).
