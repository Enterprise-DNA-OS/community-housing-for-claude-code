---
description: "Bring properties, households and tenancies across from a Civica Cx Housing tenancy report, then opening rent balances, saved as CSV."
---

# /import

Always run with --dry-run first and show the counts and warnings. Read docs/replace-civica-cx-housing.md.

```bash
node scripts/housing.mjs import cx --file=tenancies.csv --dry-run
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
