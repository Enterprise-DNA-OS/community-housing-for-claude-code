---
description: "End a tenancy with the date and reason. The home shows as a void."
---

# /end

Confirm before running. Report the void.

```bash
node scripts/housing.mjs end <tenancy> --on=YYYY-MM-DD --reason="moved on"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
