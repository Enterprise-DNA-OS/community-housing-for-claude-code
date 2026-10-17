# Moving off Civica Cx Housing

Plan on a day for a provider with a few hundred homes: an hour to export, an hour for a dry run and fixes, the rest checking rent and balances against your last Cx Housing rent run.

## 1. Set up your rent policies and programs

Rent is worked out from your rent policy, so set that up first. One row per policy, one program per funding stream:

```bash
npm run housing -- add rent_policies --code=NSW-CHRP --name="NSW community housing rent" --jurisdiction=NSW --adult-pct=25 --young-adult-pct=15 --ftb-pct=15 --cra-pct=100
npm run housing -- add programs --code=NSW-SH --name="NSW social housing" --kind=social --funder="Department of Communities and Justice" --rent-policy=NSW-CHRP
```

New Zealand income-related rent homes use `--method=external`: MSD assesses the rent and you record it.

## 2. Export from Cx Housing

Cx Housing reports are set up per provider, so there is no single export layout. Ask your Cx administrator for, or run yourself:

1. **A tenancy report:** one row per property, with its tenancy and lead tenant where it is let. Columns such as Property Ref, Address, Suburb, State, Property Type, Bedrooms, Program, Market Rent, Tenancy Ref, Household Ref, Lead Tenant, Phone, Email, Tenancy Start, Weekly Rent, Last Income Review.
2. **A rent balance report:** Tenancy Ref and Balance, as at a date you choose (the day after your last rent run in Cx is easiest).
3. **A household report** (optional but needed for the rent check): each household member with date of birth, relationship and weekly income.

Open each in Excel and save as CSV (UTF-8).

## 3. Import

```bash
npm run housing -- import cx --file=tenancies.csv --dry-run
npm run housing -- import cx --file=tenancies.csv
npm run housing -- import balances --file=balances.csv --on=2026-11-01 --dry-run
npm run housing -- import balances --file=balances.csv --on=2026-11-01
```

The dry run reports how many properties, households and tenancies would be added, and every warning, then rolls back. Both imports are safe to run twice: a second run updates rent, review dates and contact details and adds nothing new.

## What maps

| Cx Housing column (any of these names) | Goes to |
|---|---|
| Property Ref, Property Reference, Property Code, Place Ref, Asset Ref | `properties.code` (and `external_id`) |
| Address, Suburb, State, Region, Property Type, Bedrooms | the property |
| Program, Programme, Funding Program, Tenure Type, Scheme | `properties.program_id` (the program must exist) |
| Market Rent | `properties.market_rent_cents` |
| Tenancy Ref, Tenancy Number, Agreement Ref, Rent Account | `tenancies.number` |
| Household Ref, Person Ref, Tenant Ref | `households.ref` |
| Lead Tenant, Tenant Name, Main Tenant | the household and its lead member |
| Tenancy Start, Tenancy End | the tenancy dates |
| Weekly Rent, Current Rent, Rent Charged | `tenancies.rent_cents` |
| Last Income Review, Rent Review Date | `tenancies.income_checked_on` |
| Balance, Arrears, Current Balance (balances file) | one opening balance line on the rent ledger |

Dates read as YYYY-MM-DD or DD/MM/YYYY. Amounts can carry $ and commas. A property row with no lead tenant comes in as an empty home.

If your report uses other column names, either rename the headers in Excel or ask Claude Code: "map my Cx tenancy report columns". It adds your names to `COLUMNS` in `scripts/housing.mjs` and a test.

## What does not carry over

- **Household members and income** are not in the tenancy report. Until they are added, the rent check (`/rent`, RENT-ABOVE-POLICY) cannot run for that household; the import warns how many. Bring them from your household report with Claude Code, or add them as each income review comes round.
- **Ledger history.** Only the opening balance comes across, not every past transaction. Keep a final Cx rent statement per tenancy on file.
- **Repairs, inspections and the waiting list.** Open repairs and the waiting list are usually short enough to add with `/request` and `/apply`; last smoke alarm, gas and electrical check dates come across with `/inspect --on=date`, or ask Claude Code to import your compliance report.
- **Documents and attachments** (signed agreements, photos) stay in your document store. Add a link field with `/customise` if you want them referenced.
- **The tenant portal and contractor access.** See [why-no-front-end.md](why-no-front-end.md).

## Check it before you switch

1. `npm run housing -- tenancies` and compare the count and total weekly rent with your last Cx rent run.
2. `npm run housing -- arrears` and compare with the Cx arrears report on the same date.
3. `npm run housing -- rent` once household income is in: every positive gap is a household paying more than your policy says. Check those before the first rent run here.
4. Run `npm run housing -- rent-run --dry-run` and compare the total with a normal Cx rent week.

Enterprise DNA does this migration for you, maps your exact reports and checks every balance: https://enterprisedna.co/omni/instead-of/civica-cx-housing
