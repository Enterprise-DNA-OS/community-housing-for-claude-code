# Record checks and where each rule comes from

`node scripts/housing.mjs compliance` (and `/compliance`) runs every check below against your records. Each finding names its rule and its source. These are record checks, not legal advice: they tell you where your records say something needs doing, and where to read the rule. Laws and policies change, so check the current text before you act on a finding, and change a number in `settings` (or ask `/customise`) when your policy or your state differs.

## RENT-ABOVE-POLICY

**What it checks:** a household on formula rent is charged more than its rent policy works out, by more than a dollar a week.

**How the policy rent is worked out:** each current household member is put in a band. The tenant, their partner and every member aged 21 or over count at the adult rate (25% in the demo policies). Members aged 18 to 20 count at the young adult rate (15%). Children under 18 are not assessed. Then the policy adds a share of Family Tax Benefit (15%) and Commonwealth Rent Assistance (100%), and caps the total at market rent. Every rate lives on the `rent_policies` row, so a provider charging 30% sets 30.

**Sources:** the NSW Community Housing Rent Policy (Department of Communities and Justice, version 3.1, 2021) sets rent at 25% to 30% of assessable household income, 15% for members aged 18 to 20, 15% of Family Tax Benefit and 100% of CRA, with market rent the most a tenant can be charged. Queensland's community housing rent policy uses 25% of assessable income plus 100% of CRA. Your own rent policy, which your regulator expects you to follow, is the one that counts.

## RENT-ABOVE-MARKET

**What it checks:** any household is charged more than the property's market rent. For New Zealand homes, where the Ministry of Social Development assesses income-related rent and the provider records it, this is the only rent check that runs.

**Source:** every rent policy above caps rent at market rent. In New Zealand, income-related rent sits under the Public and Community Housing Management Act 1992, and the market rent of the home is the most a tenant pays.

## INCOME-REVIEW

**What it checks:** a formula-rent household whose last income review is older than `review_months` (12 by default), or will be within `warn_days`.

**Source:** your rent policy sets the review cycle. Many NSW providers review every six months; set `review_months` to match. Keeping rent assessments current is part of tenant and housing services under the National Regulatory Code (Performance Outcome 1) for providers registered with the National Regulatory System for Community Housing.

## RENT-NOTICE

**What it checks:** a rent increase in the last 12 months recorded with no notice date, or with less notice than the law requires before the new rent took effect.

**Sources:**

- NSW: Residential Tenancies Act 2010 (NSW) s 41, at least 60 days written notice of a rent increase.
- Victoria: Residential Tenancies Act 1997 (Vic) s 44, at least 60 days written notice.
- Queensland: Residential Tenancies and Rooming Accommodation Act 2008 (Qld) s 91, at least two months written notice (set as 61 days), and s 93, at least 12 months between increases for the property.
- New Zealand: Residential Tenancies Act 1986 (NZ) s 24, at least 60 days written notice.

Social housing agreements can have their own rules for rent changes that follow an income review. Check yours, and change `rent_notice_days` if your agreement differs.

## ARREARS-THRESHOLD

**What it checks:** a current tenancy whose balance is at or past the number of days of rent at which the state's tenancy law allows a formal notice, with no arrears notice recorded during that time.

**Days in arrears** is the balance divided by the weekly rent, times seven. Rent posted for the current week and paid on time is not arrears.

**Sources:**

- NSW: Residential Tenancies Act 2010 (NSW) s 88, a termination notice for rent unpaid for at least 14 days.
- Victoria: Residential Tenancies Act 1997 (Vic) s 91ZM, a notice to vacate for rent unpaid for at least 14 days.
- Queensland: Residential Tenancies and Rooming Accommodation Act 2008 (Qld) s 325, a notice to remedy breach once rent is unpaid for 7 days.
- New Zealand: Residential Tenancies Act 1986 (NZ) s 55(1)(a), rent at least 21 days in arrears.

A finding here is not a decision to end a tenancy. Community housing providers work under sustaining tenancies policies: call, agree a plan, involve the support worker, then follow the formal steps. Record a formal notice with `notice <tenancy> --on=date` once it is served.

## SMOKE-ALARM

**What it checks:** a tenanted home whose last recorded smoke alarm check is older than `smoke_months` (12 by default), is coming due within `warn_days`, or has never been recorded.

**Sources:**

- NSW: Residential Tenancies Regulation 2019 (NSW), Schedule 1 standard form agreement cl 42.2, an annual check that all smoke alarms work. Clause 14 sets two business days to repair a faulty alarm.
- Queensland: Fire Services Act 1990 (Qld) Part 9A, smoke alarms tested and cleaned within 30 days before each tenancy starts or is renewed.
- Victoria: Residential Tenancies Regulations 2021 (Vic), the safety-related activities in Schedule 4.
- New Zealand: Residential Tenancies (Smoke Alarms and Insulation) Regulations 2016 (NZ), working smoke alarms at the start of every tenancy.

## VIC-GAS-CHECK

**What it checks:** a tenanted Victorian home with gas whose last gas safety check is more than 24 months old, coming due, or never recorded.

**Source:** Residential Tenancies Regulations 2021 (Vic), a gas safety check of all gas installations and fittings every two years by a licensed gasfitter, with records kept. Consumer Affairs Victoria publishes the guidance: consumer.vic.gov.au, "Rental providers: gas and electrical safety".

## VIC-ELECTRICAL-CHECK

**What it checks:** a tenanted Victorian home whose last electrical safety check is more than 24 months old, coming due, or never recorded.

**Source:** Residential Tenancies Regulations 2021 (Vic), an electrical safety check of all electrical installations and fittings every two years by a licensed electrician. Same Consumer Affairs Victoria guidance as above.

## NZ-HEALTHY-HOMES

**What it checks:** a tenanted New Zealand home with no passed healthy homes assessment on record.

**Source:** Residential Tenancies (Healthy Homes Standards) Regulations 2019 (NZ): heating, insulation, ventilation, moisture and drainage, and draught stopping. Kāinga Ora and registered community housing providers had to comply by 1 July 2024 (Tenancy Services and the Ministry of Housing and Urban Development). Record a passed assessment with `inspect <property> --kind="healthy homes" --result=pass`.

## COMPLAINT-RESPONSE

**What it checks:** a complaint or appeal with no response recorded within `complaint_days` (14 by default).

**Source:** the National Regulatory Code, Performance Outcome 1 (tenant and housing services), expects registered providers to handle complaints and appeals fairly and on time. In New Zealand, the Community Housing Regulatory Authority's performance standards ask the same. Set `complaint_days` to the response time in your own complaints policy.

## Adding a rule

Ask `/customise`: "add a check that every tenancy has a signed agreement on file" or "flag water usage charges older than 30 days". It writes the migration that extends `v_compliance`, adds the source here and adds a test.
