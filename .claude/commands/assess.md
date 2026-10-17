---
description: "Work out one household's rent under its policy line by line, and apply it with an effective date and notice date."
---

# /assess

First run without --apply and show the working. Only add --apply after the housing officer says yes, with --effective and, for an increase, --notice once notice is given. Report any warning about the notice period.

```bash
node scripts/housing.mjs assess <tenancy> [--apply --effective=YYYY-MM-DD --notice=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
