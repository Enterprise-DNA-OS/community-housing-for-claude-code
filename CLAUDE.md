# Community Housing for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing today | /attention |
| The Monday review | /weekly-review |
| The board or regulator numbers | /kpis, then /documents board-report |
| Rent rules, safety checks, notice periods | /compliance |
| Who pays more or less than the rent policy | /rent |
| Work out or change a household's rent | /assess (show first, --apply on a yes) |
| A change in someone's income | /income then /assess |
| Income reviews due | /reviews, /draft-review-request |
| Who is behind on rent | /arrears, /draft-arrears |
| Charge this week's rent | /rent-run (dry run first) |
| A payment or charge | /pay, /charge |
| A formal notice was served | /notice |
| Empty homes | /voids |
| Who fits an empty home | /match, then /offer and /draft-offer |
| An applicant answered | /reply, then /house if accepted |
| A tenancy ended | /end |
| The waiting list | /waitlist, /apply, /contact |
| Repairs | /repairs, /request, /done |
| Smoke alarm, gas, electrical, healthy homes | /checks, /inspect |
| Complaints and appeals | /complaints, /complaint, /resolve |
| One property, household or tenancy | /property, /household, /tenancy |
| Lists | /properties, /households, /tenancies, /offers |
| A question across the records | /insights |
| A note | /log |
| Any other record or a setting | /add, /update |
| Bring data from Cx Housing | /import (dry run first) |
| A backup | /export |
| Statements, assessments, reports | /documents |
| Dashboards | /view, /new-view |
| Change a field, stage or rule | /customise |

If an ask fits nothing here, run the CLI directly (`node scripts/housing.mjs help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Rent changes, notices and tenancy endings are decisions about people's homes. Show the working first and apply only on a yes in this session.
- Record checks are not legal advice. Every rule cites its source in `docs/compliance.md`; if a rule looks out of date, say so instead of guessing.
- Arrears work starts with sustaining the tenancy: a call, a plan, the support worker. Drafts never threaten.

## How rent works here

Each `rent_policies` row sets the rates: the adult rate for the tenant, partner and anyone 21 or over, the 18 to 20 rate, the Family Tax Benefit share, the Commonwealth Rent Assistance share and the market rent cap. `v_rent_assessment` works out every current household's rent from its members' income. New Zealand homes use the `external` method: the Ministry of Social Development assesses income-related rent, the provider records it, and only the market rent cap is checked.

Days in arrears is the balance divided by the weekly rent, times seven. The arrears threshold for each state is a setting.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` record check sources (`compliance.md`), the CLI reference (`cli.md`), the honest trade-offs and the guide for moving off Civica Cx Housing.
- `views.json`, `documents.json`, `brand.json` the dashboards, the paperwork and your branding.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/civica-cx-housing
