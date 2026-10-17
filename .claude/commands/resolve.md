---
description: "Record the response to a complaint or appeal."
---

# /resolve

Report it answered.

```bash
node scripts/housing.mjs resolve <complaint> --outcome="..." [--on=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
