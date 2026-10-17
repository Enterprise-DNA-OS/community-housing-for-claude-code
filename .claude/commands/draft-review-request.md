---
description: "Draft the letter asking a household for proof of income for its rent review."
---

# /draft-review-request

The draft goes to drafts/. Show it.

```bash
node scripts/housing.mjs draft-review-request <tenancy>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
