---
description: Build a 10-minute onboarding tour for CodeVerse
argument-hint: <target-directory>
---

Activate the `codeverse-tour` skill on the target directory provided as `$1` (default: `demo/shopfloor`).

Choose 6-9 waypoint stops in teaching order (front door -> core flow -> data -> edge cases), write narration and notice bullets for each, and add go-deeper question/answer pairs with citations.

Write the result to `.codeverse/recordings/<target-name>.tour.json` and finish with the file path and a one-sentence description of the tour.
