---
description: "Income reviews by due date: who is overdue, who is coming up."
---

# /reviews

Offer /draft-review-request for anyone due in the next 30 days.

```bash
node scripts/housing.mjs reviews
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
