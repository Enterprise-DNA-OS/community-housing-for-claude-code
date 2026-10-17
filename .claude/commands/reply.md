---
description: "Record an applicant's answer to an offer: accepted, declined or no response."
---

# /reply

If declined, run /match for the next applicant.

```bash
node scripts/housing.mjs reply <applicant> --accepted|--declined|--no-response [--reason=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
