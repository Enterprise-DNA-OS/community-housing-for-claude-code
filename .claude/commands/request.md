---
description: "Log a repair for a property with its priority."
---

# /request

Report the target date.

```bash
node scripts/housing.mjs request <property> <description> [--priority=urgent|priority|routine|planned] [--category=] [--contractor=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
