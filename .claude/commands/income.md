---
description: "Update a household member's weekly income after an income review."
---

# /income

Then run /assess for the household.

```bash
node scripts/housing.mjs income <member> --weekly=dollars [--source="Age Pension"]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
