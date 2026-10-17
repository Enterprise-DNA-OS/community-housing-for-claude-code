# Example Cx Housing exports

Two invented files in the shape a Cx Housing tenancy report and rent balance report take once saved from Excel as CSV. Use them to try the import before you run your own:

```bash
node scripts/housing.mjs import cx --file=examples/cx-housing/tenancies.csv --dry-run
node scripts/housing.mjs import balances --file=examples/cx-housing/balances.csv --dry-run
```

`CX-5003` has no tenant, so it comes in as an empty home. Every name, address and amount here is invented.
