# CLI reference

One CLI, `scripts/housing.mjs`. Run it as `node scripts/housing.mjs <command>` or `npm run housing -- <command>`. Human tables by default; add `--json` for machine output. Names match without case and fragments work; an ambiguous name lists the candidates and exits 1.

Money flags are dollars (`--amount=245.50`). Fields ending `_cents` are cents. Dates are YYYY-MM-DD or DD/MM/YYYY. Reference fields take a code or name: `--program=NSW-SH`, `--household=HH-1001`.

## Commands

- `policies`
- `programs`
- `properties`
- `households`
- `tenancies`
- `rent`
- `arrears`
- `reviews`
- `voids`
- `repairs`
- `checks`
- `waitlist`
- `offers`
- `complaints`
- `compliance`
- `attention`
- `kpis`
- `settings`
- `property <code>`
- `household <ref|name>`
- `tenancy <number|property|name>`
- `applicant <ref|name>`
- `ledger <tenancy> [--weeks=12]`
- `insights [1..10]`
- `show <kind> <name|id>`
- `add <kind> --field=value`
- `update <kind> <name|id> --field=value`
- `assess <tenancy> [--apply --effective=date --notice=date]`
- `income <member> --weekly=dollars [--source=]`
- `rent-run [--on=date] [--dry-run]`
- `pay <tenancy> --amount=dollars [--on=date] [--ref=]`
- `charge <tenancy> --amount=dollars --kind=water|repair charge|adjustment [--on=date] [--note=]`
- `notice <tenancy> [--on=date]`
- `request <property> <description> [--priority=urgent|priority|routine|planned] [--category=] [--contractor=]`
- `done <repair> [--cost=dollars] [--on=date] [--tenant-damage]`
- `inspect <property> --kind=routine|smoke alarm|gas|electrical|healthy homes|entry|exit [--result=pass|issues|fail] [--on=date] [--by=] [--note=]`
- `apply <name> --bedrooms=n [--people=n --areas="A, B" --band=priority|general|transfer --register= --phone= --accessible]`
- `contact <applicant> [--on=date] [--note=]`
- `match <property>`
- `offer <property> --to=<applicant> [--on=date]`
- `reply <applicant> --accepted|--declined|--no-response [--reason=] [--on=date]`
- `house <applicant> --property=<code> --on=date [--number=] [--rent=dollars]`
- `end <tenancy> --on=date --reason="moved on"`
- `complaint <household|applicant> <summary> [--kind=complaint|appeal|compliment] [--category=]`
- `resolve <complaint> --outcome="..." [--on=date]`
- `log <household> <note>`
- `import cx --file=tenancies.csv [--dry-run]`
- `import balances --file=balances.csv [--on=date] [--dry-run]`
- `export --out=backup.json`
- `weekly-review`
- `draft-arrears <tenancy>`
- `draft-rent-notice <tenancy>`
- `draft-offer <applicant>`
- `draft-review-request <tenancy>`

## Record kinds for add, update and show

- **rent_policies**: code, name, jurisdiction, method, adult_pct, young_adult_pct, ftb_pct, cra_pct, market_cap, note
- **programs**: code, name, kind, funder, rent_policy_id
- **properties**: code, address, suburb, region, jurisdiction, currency, dwelling, bedrooms, accessible, has_gas, ownership, program_id, market_rent_cents, offline, available_since, note, external_id
- **households**: ref, name, phone, email, support_provider, support_worker, cra_weekly_cents, ftb_weekly_cents, note, external_id
- **members**: household_id, name, born_on, relationship, income_weekly_cents, income_source, left_on
- **tenancies**: number, household_id, property_id, kind, started_on, fixed_until, rent_cents, income_checked_on, arrears_notice_on, ended_on, end_reason, external_id
- **repairs**: number, property_id, tenancy_id, reported_on, priority, category, description, contractor, done_on, cost_cents, tenant_damage
- **inspections**: property_id, kind, done_on, done_by, result, note
- **applicants**: ref, name, phone, email, people, bedrooms_needed, needs_accessible, areas, band, register_ref, listed_on, last_contact_on, status, note
- **offers**: applicant_id, property_id, offered_on, response, responded_on, reason
- **complaints**: number, household_id, applicant_id, kind, category, received_on, summary, responded_on, outcome
- **notes**: household_id, property_id, tenancy_id, title, body
- **settings**: business_name, review_months, rent_notice_days, qld_rent_notice_days, nsw_arrears_days, vic_arrears_days, qld_arrears_days, nz_arrears_days, smoke_months, gas_months, electrical_months, inspection_months, urgent_days, priority_days, routine_days, planned_days, complaint_days, void_target_days, offer_days, waitlist_contact_days, warn_days

## Environment

- `DATABASE_URL`: any Postgres (Supabase, Neon, your own). Unset means the embedded database in `.data/db`.
- `DATA_DIR`: where the embedded database lives (`DATA_DIR=.data/demo` explores the demo).
- `OUTPUT_DIR`: where drafts, views and documents are written (defaults to the repo).

Reads accept --json. Money flags are dollars; *_cents fields are cents. Drafts go to drafts/ and are never sent. Record checks are not legal advice: docs/compliance.md.
