---
description: "Record contact with an applicant (details confirmed, still needs housing)."
---

# /contact

Report the date recorded.

```bash
node scripts/housing.mjs contact <applicant> [--on=YYYY-MM-DD] [--note=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
