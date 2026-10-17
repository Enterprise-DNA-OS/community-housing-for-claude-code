---
description: "Log a complaint, appeal or compliment from a household or applicant."
---

# /complaint

Report the respond-by date.

```bash
node scripts/housing.mjs complaint <household|applicant> <summary> [--kind=complaint|appeal|compliment] [--category=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
