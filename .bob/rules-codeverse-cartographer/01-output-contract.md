# Output Contract

- The output file must validate against the `schema.json` shipped with the active skill. No JSON comments, no trailing commas, no Markdown fences inside the file.
- All paths in the output are repo-relative POSIX paths (example: `demo/shopfloor/src/payment/payment.service.ts`). Never absolute paths, never `..`.
- Every claim in the output cites `file:line`. Where the claim is about a function, method or class, include `symbol` in `ClassName.method` form.
- Write the file once, at the end. If validation fails in your own review, fix the JSON before finishing.
- Finish every task with a short plain-language summary in chat and the path of the JSON file written.
