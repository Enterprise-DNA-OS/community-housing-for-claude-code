---
description: "Post this week's rent charge to every current tenancy. Never charges a week twice."
---

# /rent-run

Run with --dry-run first and show the total, then run it for real on a yes.

```bash
node scripts/housing.mjs rent-run [--on=YYYY-MM-DD] [--dry-run]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
