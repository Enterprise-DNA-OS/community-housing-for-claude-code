---
description: "Record that a formal arrears notice was served."
---

# /notice

Only record a notice that has actually been served.

```bash
node scripts/housing.mjs notice <tenancy> [--on=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
