---
description: Map a codebase for CodeVerse (semantic layer JSON)
argument-hint: <target-directory>
---

Activate the `codeverse-scan` skill on the target directory provided as `$1` (default: `demo/shopfloor`).

If the active mode is not CodeVerse Cartographer, tell the user to switch first by typing `/codeverse-cartographer`.

Run the full scan workflow: list the target structure, identify service districts, spawn `explore` subagents in parallel for each district, find entry points, trace up to three data flows, then write the result to `.codeverse/recordings/<target-name>.semantic.json`.

Finish with the file path and a three-line summary covering: what the target does, how many districts were found, and the most important data flow traced.
