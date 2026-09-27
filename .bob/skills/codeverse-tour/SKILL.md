---
name: codeverse-tour
description: Build a 10-minute onboarding tour of a codebase for CodeVerse. Choose 6-9 ordered stops (districts, files, datastores), write narration and what to notice at each, add go-deeper questions with answers, cite file:line, and write a codeverse.tour JSON file.
---

# CodeVerse Tour

Follow these steps to produce a `codeverse.tour` JSON file for a codebase.

<Steps>

<Step>
**Get the big picture.** Identify entry points, districts, and datastores. Spawn `explore` subagents for districts in parallel to gather responsibilities quickly.
</Step>

<Step>
**Choose 6-9 waypoint stops.** Arrange them in teaching order: front door -> core flow -> data -> edge cases. Each stop's `node` is one of:
- a district id: `svc:<folder>`
- a repo-relative file path
- a datastore id: `db:<path of the db client file>`
</Step>

<Step>
**Write each waypoint.** For each stop:
- `title`: six words or fewer
- `narration`: 2-4 sentences in plain language explaining what this stop is and why it matters
- `notice`: 2-3 bullet strings highlighting key details
- `related`: citation objects pointing to the most relevant lines
- `deeper`: 1-2 question/answer pairs with citations for the "go deeper" button
</Step>

<Step>
**Write the output file.** Write `.codeverse/recordings/<target-name>.tour.json` with the following top-level fields:

```
kind: "codeverse.tour"
schemaVersion: 1
synthetic: false
generatedBy: { tool: "ibm-bob", client: "bob-ide", mode: "codeverse-cartographer", skill: "codeverse-tour" }
target, title, estimatedMinutes (10 or fewer), waypoints
```

Refer to `schema.json` and `example.json` in this skill folder for the exact shape.
</Step>

<Step>
**Self-review.** Work through `checklist.md` item by item before finishing. Fix any issue found. Then post a short plain-language summary in chat and the path of the file written.
</Step>

</Steps>
