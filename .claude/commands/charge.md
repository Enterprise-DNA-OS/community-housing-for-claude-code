---
description: "Add a water, repair or adjustment charge to a rent account."
---

# /charge

Report the new balance.

```bash
node scripts/housing.mjs charge <tenancy> --amount=dollars --kind=water|repair charge|adjustment [--note=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
