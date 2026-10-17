---
description: "Change fields on any record, or a setting."
---

# /update

Say what changed.

```bash
node scripts/housing.mjs update <kind> <name|id> --field=value
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
