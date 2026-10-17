# Why there is no front end

Civica Cx Housing is a set of screens over property, tenancy, rent and repair records. The records underneath are ordinary: properties, households, tenancies, rent assessments, a rent ledger, repairs, inspections, applicants. What you pay for is the layer on top that lets staff get at them without writing a query. Screens, filters, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want, and it writes the query, runs it, and explains the answer. Ask a question the dashboard never had a chart for (which households pay more than the rent policy says, what each empty home has cost since the keys came back, which applicants fit a home that is empty right now) and you still get an answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor decided to chart. Here you ask your own question, in your own words, against your own records.
- **Your rent policy, worked out in the open.** Every household's rent is shown line by line: each person's income and band, Family Tax Benefit, Rent Assistance, the market cap. Change a rate in one row.
- **No seats.** Every tenancy officer, finance and assets person can look. The bill does not grow with headcount or homes.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time.

## What you give up

- **A tenant portal.** Cx Housing can give tenants a portal to check their account and lodge repairs. This has none; tenants do not log in.
- **A contractor app.** Contractors do not see jobs on their phone. Repairs are recorded here and sent the way you send them now.
- **Finance integration out of the box.** Payments are recorded from your bank or Centrepay file; your general ledger stays in your accounting system.
- **A visual board.** Repairs and the waiting list are lists you ask about, not cards you drag.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for providers who want someone to call.

Enterprise DNA builds the screens a provider needs on top of the same database when they matter: a tenant page for balances and repair requests, a contractor job sheet, a feed from your bank file.

## Who this fits

Providers whose office staff spend their week on rent reviews, arrears, voids, repairs, safety checks and allocations, and who would rather ask than click. If your tenants live in a portal, keep it for them and run the office from here.

Installed and run for you: https://enterprisedna.co/omni/instead-of/civica-cx-housing
