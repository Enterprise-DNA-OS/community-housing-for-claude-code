---
description: "Write the Monday housing review from the performance numbers, attention and record checks."
---

# /weekly-review

The CLI saves a review in drafts/. Read it and give the housing manager their three priorities for the week.

```bash
node scripts/housing.mjs weekly-review
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
