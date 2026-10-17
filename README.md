<h1 align="center">Community Housing for Claude Code</h1>

<p align="center">
  <strong>The open-source community housing system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Civica Cx Housing data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=civica-cx-housing">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/civica-cx-housing?utm_source=github&utm_medium=readme&utm_campaign=civica-cx-housing">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-civica-cx-housing">Instead of Civica Cx Housing</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Community Housing for Claude Code does the job you pay Civica Cx Housing for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Cx Housing dashboard cannot.

Civica does not publish a price for Cx Housing. Its Australian announcements describe multi-year software agreements signed by community housing providers managing thousands of homes, such as a five-year partnership with a provider housing more than 8,000 people (civica.com, checked 17 October 2026). Here there is no licence fee: the database is yours.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=civica-cx-housing).

It covers how a community housing provider actually runs: properties and the programs that fund them, households and everyone in them, tenancies, rent set from household income under your rent policy (25% to 30% of income, 15% for 18 to 20 year olds, a share of Family Tax Benefit, 100% of Commonwealth Rent Assistance, capped at market rent), the weekly rent ledger and arrears in days, income reviews, repairs against target times, smoke alarm, gas, electrical and healthy homes checks, empty homes and what is holding them up, the waiting list, offers and allocations, and complaints and appeals. It knows the rules that bite: the NSW, Victorian, Queensland and New Zealand arrears thresholds and rent increase notice periods, Victoria's two-yearly gas and electrical checks, and New Zealand's healthy homes standards. It is for the housing manager, tenancy officers and finance staff at a provider with fifty to a few thousand homes in Australia or New Zealand.

What it is not: a tenant portal, a contractor app or a general ledger. Rent payments arrive from your bank or Centrepay file and are recorded here; your accounts stay in your accounting system. See [docs/why-no-front-end.md](docs/why-no-front-end.md).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No licence quote, no seats. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/community-housing-for-claude-code.git
cd community-housing-for-claude-code
npm install
npm run demo
```

`npm run demo` loads a fictional provider with 24 homes in western Sydney, Geelong, Logan and Christchurch into `.data/demo` and prints what needs attention, the rent arrears and the performance numbers. Then open the folder in Claude Code and type `/attention`, or ask "who is paying more rent than our policy says?".

```bash
npm test                                   # 200 checks on a throwaway database
DATA_DIR=.data/demo npm run housing -- assess T-1005
DATA_DIR=.data/demo npm run housing -- insights 1
DATA_DIR=.data/demo npm run view           # views/week.html, rent.html, voids.html, safety.html
DATA_DIR=.data/demo npm run docs           # docs-out/: rent statements, rent assessments, property records, board report
```

For real records, use a fresh database and run `npm run migrate` without seeding. Set up your rent policies and programs, then import your Cx Housing tenancy report.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that needs a housing officer today: rule findings, rent arrears, late repairs, long voids, unanswered offers, complaints due and stale applicants. |
| `/weekly-review` | Write the Monday housing review from the performance numbers, attention and record checks. |
| `/kpis` | The performance numbers a board and regulator ask for: occupancy, days to relet, arrears, repairs and complaints on time, failed tenancies, safety checks and income reviews current. |
| `/compliance` | Check the records against the rent policy and tenancy rules in docs/compliance.md and report what is late or about to be, with the rule cited. |
| `/rent` | Every current tenancy against its rent policy: household income, CRA, market rent, the policy rent, what is charged and the gap. |
| `/assess` | Work out one household's rent under its policy line by line, and apply it with an effective date and notice date. |
| `/income` | Update a household member's weekly income after an income review. |
| `/reviews` | Income reviews by due date: who is overdue, who is coming up. |
| `/arrears` | Households behind on rent: owed, days in arrears, the state threshold and the last payment. |
| `/rent-run` | Post this week's rent charge to every current tenancy. Never charges a week twice. |
| `/pay` | Record a rent payment. |
| `/charge` | Add a water, repair or adjustment charge to a rent account. |
| `/notice` | Record that a formal arrears notice was served. |
| `/voids` | Empty homes: the stage each is at, days empty, rent lost and open repairs. |
| `/match` | Applicants on the waiting list who fit an empty home, priority first. |
| `/offer` | Offer an empty home to an applicant. |
| `/reply` | Record an applicant's answer to an offer: accepted, declined or no response. |
| `/house` | Start a tenancy for an applicant who accepted: household, tenancy, applicant housed. |
| `/end` | End a tenancy with the date and reason. The home shows as a void. |
| `/offers` | Every offer and its answer, open ones first. |
| `/waitlist` | The waiting list by band and time waiting, with last contact. |
| `/apply` | Add an applicant to the waiting list. |
| `/contact` | Record contact with an applicant (details confirmed, still needs housing). |
| `/repairs` | Repairs against their target dates by priority. |
| `/request` | Log a repair for a property with its priority. |
| `/done` | Close a repair with its cost. |
| `/checks` | Safety checks by property: smoke alarms, gas, electrical, healthy homes and routine inspections, with due dates. |
| `/inspect` | Record a smoke alarm check, gas or electrical check, healthy homes assessment or inspection. |
| `/complaints` | Complaints and appeals against their response date. |
| `/complaint` | Log a complaint, appeal or compliment from a household or applicant. |
| `/resolve` | Record the response to a complaint or appeal. |
| `/properties` | Every property: address, size, program, market rent and who lives there. |
| `/property` | One property: its tenancies, safety checks, repairs and any open findings. |
| `/households` | Every household, how many people, their home and support provider. |
| `/household` | One household: members and income, tenancies, balance, notes and complaints. |
| `/tenancies` | Every current tenancy with rent, market rent and last income review. |
| `/tenancy` | One tenancy: balance, rent history and the rent working under its policy. |
| `/insights` | Answer one or all of the ten questions the housing system never answered. |
| `/draft-arrears` | Draft a supportive rent arrears letter that offers a payment plan. |
| `/draft-rent-notice` | Draft the notice of a rent change, with the working and the notice period for an increase. |
| `/draft-offer` | Draft the offer of housing letter for an applicant's latest offer. |
| `/draft-review-request` | Draft the letter asking a household for proof of income for its rent review. |
| `/log` | Add a note to a household (and its latest tenancy). |
| `/add` | Add a record of any kind: a property, household member, program, rent policy, inspection. |
| `/update` | Change fields on any record, or a setting. |
| `/import` | Bring properties, households and tenancies across from a Civica Cx Housing tenancy report, then opening rent balances, saved as CSV. |
| `/export` | Write every record to one JSON file. |
| `/documents` | Render rent statements, rent assessments, property compliance records and the board and regulator report as branded HTML. |
| `/view` | Render the read-only dashboards: the week, rent against policy, empty homes and safety checks. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

The full CLI reference is [docs/cli.md](docs/cli.md). Every read takes `--json`. Names match without case, fragments work, and an ambiguous name lists the candidates and exits 1. Drafts go to `drafts/` and are never sent.

## Ten questions to ask across your own records

These run today with `npm run housing -- insights`:

1. Which households are charged more than the rent policy says, and what does that add up to over a year?
2. Which households are charged less than the policy says, and how much rent is the provider missing?
3. What are empty homes costing, and what is holding each one up?
4. How long does each region take to relet a home, from keys back to the next tenancy?
5. Which households have paid less than they were charged over the last four weeks, before they reach the arrears threshold?
6. How much of the weekly rent roll comes from Commonwealth Rent Assistance, by program?
7. Which waiting applicants fit a home that is empty right now?
8. Which contractors are slowest against the repair target, and what have they cost in the last 12 months?
9. Which tenancies ended owing rent, and how much do former tenants owe?
10. How long have people on the waiting list been waiting, by band and home size?

## Your first hour: ten things to ask for

1. "Set up our rent policy: 27.5% of income, 15% for 18 to 20 year olds, 100% of CRA." (`/customise`, then `/update`)
2. "Import our Cx Housing tenancy report and opening balances, dry run first." (`/import`)
3. "Who is paying more than our rent policy says, and who is paying less?" (`/rent`)
4. "Who is past the arrears threshold, and draft each a letter offering a payment plan." (`/arrears`, `/draft-arrears`)
5. "Whose income review is due this month? Draft the requests." (`/reviews`, `/draft-review-request`)
6. "What is every empty home costing us and what is it waiting on?" (`/voids`, `/insights 3`)
7. "Who on the waiting list fits PR-108?" (`/match`)
8. "Which homes are missing a smoke alarm check or a gas check?" (`/checks`, `/compliance`)
9. "Write the Monday review and the board performance report." (`/weekly-review`, `/documents`)
10. "Add a field for the support agreement end date and flag ones ending in 60 days." (`/customise`)

## Instead of Civica Cx Housing

Cx Housing reports are configured per provider, so there is no single export layout. Run your tenancy report (property, tenancy and lead tenant on one row) and your rent balance report, save each from Excel as CSV, and import them:

```bash
npm run housing -- import cx --file=tenancies.csv --dry-run
npm run housing -- import cx --file=tenancies.csv
npm run housing -- import balances --file=balances.csv --on=2026-11-01
```

The import reads the common column names (Property Ref, Address, Program, Market Rent, Tenancy Ref, Lead Tenant, Tenancy Start, Weekly Rent, Last Income Review, Balance) and is safe to run twice. Household members and income come across next, from your household report or by asking Claude Code to map it. The full guide, with what maps and what does not, is [docs/replace-civica-cx-housing.md](docs/replace-civica-cx-housing.md). Example files: [examples/cx-housing](examples/cx-housing).

## Architecture

```
community-housing-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/housing.mjs       the one CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data: a fictional provider, 24 homes, NSW, VIC, QLD and NZ
  views.json                read-only dashboards (npm run view)
  documents.json            rent statements, assessments, property records, board report (npm run docs)
  brand.json                your name and colours on every view and document
  docs/                     compliance sources, CLI reference, the Cx Housing guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Community Housing for Claude Code for your business, migrates your Civica Cx Housing data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=civica-cx-housing)
- Read more: [enterprisedna.co/omni/instead-of/civica-cx-housing](https://enterprisedna.co/omni/instead-of/civica-cx-housing?utm_source=github&utm_medium=readme&utm_campaign=civica-cx-housing)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
