---
description: "Draft the offer of housing letter for an applicant's latest offer."
---

# /draft-offer

The draft goes to drafts/. Show it.

```bash
node scripts/housing.mjs draft-offer <applicant>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
