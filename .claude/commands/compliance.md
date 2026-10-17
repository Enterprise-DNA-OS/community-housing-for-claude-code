---
description: "Check the records against the rent policy and tenancy rules in docs/compliance.md and report what is late or about to be, with the rule cited."
---

# /compliance

Group by rule. For each, the record, the finding and the source. Nothing here is legal advice; if a rule looks out of date, say so and stop.

```bash
node scripts/housing.mjs compliance
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
