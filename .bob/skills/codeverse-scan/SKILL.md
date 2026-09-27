---
name: codeverse-scan
description: Map a codebase for CodeVerse. Label each service district with its responsibility, find entry points and trace the main data flows, citing file:line, and write a codeverse.semantic JSON file.
---

# CodeVerse Scan

Follow these steps to produce a `codeverse.semantic` JSON file for the target codebase.

<Steps>

<Step>
**Identify the target.** Read the target directory from the request (default: `demo/shopfloor`). List its top-level structure to understand layout.
</Step>

<Step>
**Identify service districts.** Districts are the folders directly under `src/` for a single app, or `packages/<name>` / `apps/<name>` for a monorepo. Assign each an id of the form `svc:<folder>` (for example `svc:payment` or `svc:packages/schema`). Use exactly these ids throughout the output.
</Step>

<Step>
**Explore districts in parallel.** Spawn `explore` subagents in parallel groups — each one reads the files in one district and answers: "In two sentences, what is this district responsible for? Cite file:line."
</Step>

<Step>
**Find entry points.** Locate HTTP route registration files, `main`/`server`/`cli` entry files, and exported factory functions. Each entry point needs a `file`, an optional `symbol`, a `description`, and at least one `citation`.
</Step>

<Step>
**Trace 1-3 important data flows.** Trace end-to-end (for a shop: the checkout flow). Each step records `from` file, `to` file, `via` (calling symbol), and a `citation` of the call site.
</Step>

<Step>
**Write the output file.** Write `.codeverse/recordings/<target-name>.semantic.json` (for `demo/shopfloor`: `shopfloor.semantic.json`) with the following top-level fields:

```
kind: "codeverse.semantic"
schemaVersion: 1
synthetic: false
generatedBy: { tool: "ibm-bob", client: "bob-ide", mode: "codeverse-cartographer", skill: "codeverse-scan" }
target, summary, services, entryPoints, dataFlows
```

Refer to `schema.json` and `example.json` in this skill folder for the exact shape.
</Step>

<Step>
**Self-review.** Work through `checklist.md` item by item before finishing. Fix any issue found. Then post a short plain-language summary in chat and the path of the file written.
</Step>

</Steps>
