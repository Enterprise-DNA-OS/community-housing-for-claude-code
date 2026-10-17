---
description: "Start a tenancy for an applicant who accepted: household, tenancy, applicant housed."
---

# /house

Then add the household members and income and run /assess.

```bash
node scripts/housing.mjs house <applicant> --property=<code> --on=YYYY-MM-DD [--rent=dollars]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
