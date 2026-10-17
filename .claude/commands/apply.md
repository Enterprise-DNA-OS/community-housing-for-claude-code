---
description: "Add an applicant to the waiting list."
---

# /apply

Report their reference.

```bash
node scripts/housing.mjs apply <name> --bedrooms=n [--people=n --areas="Penrith, St Marys" --band=priority|general|transfer --register= --phone= --accessible]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
