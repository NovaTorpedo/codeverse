# CodeVerse

**See your software think.** CodeVerse turns a repository into a living 3D city and replays how IBM Bob investigates it, step by step, with every claim checked against the code.

- **Live demo:** _coming soon_
- **Video:** _coming soon_

## How IBM Bob powers CodeVerse

IBM Bob is the engine. A CodeVerse custom mode, skills and slash commands (in [`.bob/`](.bob/)) let a developer type `/codeverse-investigate Payment failed during checkout` in Bob IDE. Bob explores the codebase with subagents, explains the root cause with file and line citations, and proposes a fix. CodeVerse then shows that investigation in the city: which buildings Bob read, where its subagents went, the request path that broke, and a Grounding Score that verifies each of Bob's claims against a deterministic map of the code. Screenshots of the Bob sessions are in [`bob_sessions/`](bob_sessions/).

## Run it

```bash
npm install
npm run dev
```

## License

MIT, see [LICENSE](LICENSE).
