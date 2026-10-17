---
description: "Record a smoke alarm check, gas or electrical check, healthy homes assessment or inspection."
---

# /inspect

Report it recorded and whether a finding cleared.

```bash
node scripts/housing.mjs inspect <property> --kind="smoke alarm" [--result=pass|issues|fail] [--on=YYYY-MM-DD] [--by=] [--note=]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
