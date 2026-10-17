-- Demo data: one fictional community housing provider with homes in western Sydney (NSW), Geelong (VIC),
-- Logan (QLD) and Christchurch (NZ). Dates are relative to today, so there is always rent behind, an income
-- review overdue, a void dragging, a repair late, a safety check missed and an offer with no answer.
-- Idempotent: unique codes and numbers, on conflict do nothing. Every name and record here is invented.

update settings set business_name = 'Tidewater Community Housing (demo)' where id = 1;

insert into rent_policies (code, name, jurisdiction, method, adult_pct, young_adult_pct, ftb_pct, cra_pct, market_cap, note) values
  ('NSW-CHRP', 'NSW community housing rent', 'NSW', 'formula', 25, 15, 15, 100, true, '25% of tenant, partner and adult income, 15% for 18 to 20 year olds, 15% of FTB, 100% of CRA, capped at market rent'),
  ('VIC-CH', 'Victorian community housing rent', 'VIC', 'formula', 25, 15, 15, 100, true, '25% of assessable income plus 100% of CRA, capped at market rent'),
  ('QLD-CHRP', 'Queensland community housing rent', 'QLD', 'formula', 25, 15, 15, 100, true, '25% of assessable income plus 100% of CRA, capped at market rent'),
  ('NZ-IRR', 'Income-related rent (MSD assessed)', 'NZ', 'external', 25, 0, 0, 0, true, 'MSD assesses income-related rent; record it on the tenancy')
on conflict (code) do nothing;

insert into programs (code, name, kind, funder, rent_policy_id)
select x.code, x.name, x.kind, x.funder, rp.id from (values
  ('NSW-SH', 'NSW social housing', 'social', 'Department of Communities and Justice', 'NSW-CHRP'),
  ('NSW-SEN', 'NSW seniors housing', 'seniors', 'Department of Communities and Justice', 'NSW-CHRP'),
  ('VIC-SH', 'Victorian social housing', 'social', 'Homes Victoria', 'VIC-CH'),
  ('QLD-SH', 'Queensland community housing', 'social', 'Department of Housing', 'QLD-CHRP'),
  ('NZ-IRR', 'Income-related rent homes', 'social', 'Ministry of Housing and Urban Development', 'NZ-IRR')
) as x(code, name, kind, funder, policy) join rent_policies rp on rp.code = x.policy
on conflict (code) do nothing;

insert into properties (code, address, suburb, region, jurisdiction, currency, dwelling, bedrooms, accessible, has_gas, ownership, program_id, market_rent_cents, offline, available_since)
select x.code, x.address, x.suburb, x.region, x.jur, x.cur, x.dwelling, x.beds, x.acc, x.gas, x.own, g.id, x.market, x.offline, current_date + x.avail
from (values
  ('PR-101', '4/18 Lethbridge St', 'Penrith', 'Western Sydney', 'NSW', 'AUD', 'unit', 1, true, false, 'owned', 'NSW-SEN', 41000, false, null::int),
  ('PR-102', '2/18 Lethbridge St', 'Penrith', 'Western Sydney', 'NSW', 'AUD', 'unit', 2, false, false, 'owned', 'NSW-SH', 49500, false, null),
  ('PR-103', '27 Rance Rd', 'Werrington', 'Western Sydney', 'NSW', 'AUD', 'house', 3, false, true, 'leased from government', 'NSW-SH', 58000, false, null),
  ('PR-104', '9/51 Carlisle Ave', 'Mount Druitt', 'Western Sydney', 'NSW', 'AUD', 'apartment', 2, false, false, 'head-leased', 'NSW-SH', 47000, false, null),
  ('PR-105', '14 Bellbird Cres', 'Blacktown', 'Western Sydney', 'NSW', 'AUD', 'townhouse', 3, false, true, 'owned', 'NSW-SH', 62000, false, null),
  ('PR-106', '6/3 Station St', 'St Marys', 'Western Sydney', 'NSW', 'AUD', 'unit', 1, true, false, 'owned', 'NSW-SEN', 40000, false, null),
  ('PR-107', '33 Kurrajong Rd', 'Mount Druitt', 'Western Sydney', 'NSW', 'AUD', 'house', 4, false, false, 'leased from government', 'NSW-SH', 66000, false, null),
  ('PR-108', '1/7 Hope St', 'Penrith', 'Western Sydney', 'NSW', 'AUD', 'unit', 2, false, false, 'owned', 'NSW-SH', 49000, false, null),
  ('GL-201', '12 Autumn St', 'Geelong West', 'Geelong', 'VIC', 'AUD', 'house', 3, false, true, 'owned', 'VIC-SH', 52000, false, null),
  ('GL-202', '5/40 Pakington St', 'Geelong West', 'Geelong', 'VIC', 'AUD', 'unit', 1, false, false, 'owned', 'VIC-SH', 36000, false, null),
  ('GL-203', '88 Thompson Rd', 'Norlane', 'Geelong', 'VIC', 'AUD', 'house', 3, false, true, 'leased from government', 'VIC-SH', 44000, false, null),
  ('GL-204', '3/21 Corio St', 'Corio', 'Geelong', 'VIC', 'AUD', 'unit', 2, true, false, 'owned', 'VIC-SH', 39000, false, null),
  ('GL-205', '17 Separation St', 'Bell Park', 'Geelong', 'VIC', 'AUD', 'townhouse', 2, false, true, 'owned', 'VIC-SH', 42000, false, null),
  ('GL-206', '2/9 Fyans St', 'South Geelong', 'Geelong', 'VIC', 'AUD', 'unit', 2, false, false, 'owned', 'VIC-SH', 41000, false, null),
  ('LG-301', '41 Wembley Rd', 'Logan Central', 'Logan', 'QLD', 'AUD', 'house', 3, false, false, 'owned', 'QLD-SH', 52000, false, null),
  ('LG-302', '7/12 Ewing St', 'Woodridge', 'Logan', 'QLD', 'AUD', 'unit', 2, false, false, 'owned', 'QLD-SH', 43000, false, null),
  ('LG-303', '19 Kingston Rd', 'Kingston', 'Logan', 'QLD', 'AUD', 'townhouse', 3, true, false, 'head-leased', 'QLD-SH', 50000, false, null),
  ('LG-304', '2/66 Station Rd', 'Woodridge', 'Logan', 'QLD', 'AUD', 'unit', 1, false, false, 'owned', 'QLD-SH', 36000, false, null),
  ('LG-305', '9 Paradise Rd', 'Slacks Creek', 'Logan', 'QLD', 'AUD', 'house', 4, false, false, 'owned', 'QLD-SH', 58000, true, null),
  ('CH-401', '22 Gloucester St', 'Linwood', 'Christchurch', 'NZ', 'NZD', 'unit', 1, false, false, 'owned', 'NZ-IRR', 39000, false, null),
  ('CH-402', '5 Aldwins Rd', 'Phillipstown', 'Christchurch', 'NZ', 'NZD', 'house', 3, false, false, 'owned', 'NZ-IRR', 56000, false, null),
  ('CH-403', '3/118 Hills Rd', 'Shirley', 'Christchurch', 'NZ', 'NZD', 'townhouse', 2, true, false, 'owned', 'NZ-IRR', 48000, false, null),
  ('CH-404', '61 Pages Rd', 'Aranui', 'Christchurch', 'NZ', 'NZD', 'house', 4, false, false, 'managed for owner', 'NZ-IRR', 62000, false, null),
  ('CH-405', '8/40 Worcester St', 'Linwood', 'Christchurch', 'NZ', 'NZD', 'studio', 0, false, false, 'owned', 'NZ-IRR', 33000, false, -20)
) as x(code, address, suburb, region, jur, cur, dwelling, beds, acc, gas, own, program, market, offline, avail)
join programs g on g.code = x.program
on conflict (code) do nothing;

insert into households (ref, name, phone, email, support_provider, support_worker, cra_weekly_cents, ftb_weekly_cents, note) values
  ('HH-1001', 'Margaret Hollis', '0412 555 101', null, null, null, 9400, 0, null),
  ('HH-1002', 'Daniel Okafor', '0412 555 102', 'd.okafor@example.com', null, null, 11000, 12500, null),
  ('HH-1003', 'Tanya Reid', '0412 555 103', null, 'Nepean Family Support (demo)', 'Kim Patel', 12400, 21000, 'Prefers text messages'),
  ('HH-1004', 'Ahmad Rahimi', '0412 555 104', null, null, null, 11000, 0, null),
  ('HH-1005', 'Lisa and Mark Brennan', '0412 555 105', 'brennans@example.com', null, null, 13800, 18000, null),
  ('HH-1006', 'Joyce Tan', '0412 555 106', null, null, null, 9400, 0, null),
  ('HH-1007', 'Sione Fifita', '0412 555 107', null, 'Western Sydney Tenancy Support (demo)', 'Ruth Allen', 14600, 26000, 'Large family, needs four bedrooms'),
  ('HH-1008', 'Peter Lowe', '0412 555 108', null, null, null, 0, 0, 'Moved interstate'),
  ('HH-1009', 'Kerry Walsh', '0412 555 109', null, null, null, 12400, 15000, null),
  ('HH-1010', 'Graham Pike', '0412 555 110', null, 'Barwon Mental Health (demo)', 'Sam Ortiz', 9400, 0, null),
  ('HH-1011', 'Amira Hassan', '0412 555 111', null, null, null, 12400, 19000, null),
  ('HH-1012', 'Betty Moore', '0412 555 112', null, null, null, 9400, 0, null),
  ('HH-1013', 'Jordan Clarke', '0412 555 113', null, null, null, 11000, 0, null),
  ('HH-1014', 'Nathan Byrne', '0412 555 114', null, null, null, 0, 0, 'Ended tenancy, forwarding address on file'),
  ('HH-1015', 'Leanne Foster', '0412 555 115', null, null, null, 13800, 22000, null),
  ('HH-1016', 'Tui Ngata', '0412 555 116', null, null, null, 11000, 9000, null),
  ('HH-1017', 'Ray Simmons', '0412 555 117', null, 'Logan Housing Support (demo)', 'Dee Martin', 9400, 0, null),
  ('HH-1018', 'Christine Ward', '0412 555 118', null, null, null, 9400, 0, null),
  ('HH-1019', 'Wiremu Tane', '021 555 119', null, null, null, 0, 0, null),
  ('HH-1020', 'Hana Kereama', '021 555 120', null, 'Te Whare Tautoko (demo)', 'Mere Rangi', 0, 0, null),
  ('HH-1021', 'Fiona and Tom Grey', '021 555 121', null, null, null, 0, 0, null),
  ('HH-1022', 'Malakai Vea', '021 555 122', null, null, null, 0, 0, 'Whanau of seven'),
  ('HH-1023', 'Colin Price', '0412 555 123', null, null, null, 0, 0, 'Ended tenancy'),
  ('HH-1024', 'Rhonda Kelly', '0412 555 124', null, null, null, 0, 0, 'Ended tenancy'),
  ('HH-1025', 'Bill Harper', '0412 555 125', null, null, null, 0, 0, 'Ended tenancy')
on conflict (ref) do nothing;

-- Members. Ages are relative to today so the 18 to 20 band always has someone in it.
insert into members (household_id, name, born_on, relationship, income_weekly_cents, income_source)
select h.id, x.name, (current_date - make_interval(years => x.age, days => 40))::date, x.rel, x.income, x.src
from (values
  ('HH-1001', 'Margaret Hollis', 74, 'tenant', 57500, 'Age Pension'),
  ('HH-1002', 'Daniel Okafor', 38, 'tenant', 82000, 'Wages'),
  ('HH-1002', 'Grace Okafor', 9, 'child', 0, null),
  ('HH-1003', 'Tanya Reid', 31, 'tenant', 48500, 'Parenting Payment'),
  ('HH-1003', 'Jade Reid', 6, 'child', 0, null),
  ('HH-1003', 'Riley Reid', 4, 'child', 0, null),
  ('HH-1004', 'Ahmad Rahimi', 45, 'tenant', 39500, 'JobSeeker'),
  ('HH-1005', 'Lisa Brennan', 42, 'tenant', 61000, 'Wages'),
  ('HH-1005', 'Mark Brennan', 44, 'partner', 57500, 'Disability Support Pension'),
  ('HH-1005', 'Ella Brennan', 19, 'other', 32000, 'Wages'),
  ('HH-1005', 'Sam Brennan', 12, 'child', 0, null),
  ('HH-1006', 'Joyce Tan', 81, 'tenant', 57500, 'Age Pension'),
  ('HH-1007', 'Sione Fifita', 47, 'tenant', 96000, 'Wages'),
  ('HH-1007', 'Mele Fifita', 45, 'partner', 0, null),
  ('HH-1007', 'Tevita Fifita', 22, 'other', 41000, 'Wages'),
  ('HH-1007', 'Losa Fifita', 15, 'child', 0, null),
  ('HH-1007', 'Ana Fifita', 11, 'child', 0, null),
  ('HH-1009', 'Kerry Walsh', 36, 'tenant', 51000, 'Parenting Payment'),
  ('HH-1009', 'Mia Walsh', 8, 'child', 0, null),
  ('HH-1010', 'Graham Pike', 58, 'tenant', 57500, 'Disability Support Pension'),
  ('HH-1011', 'Amira Hassan', 34, 'tenant', 52000, 'Parenting Payment'),
  ('HH-1011', 'Yusuf Hassan', 7, 'child', 0, null),
  ('HH-1012', 'Betty Moore', 77, 'tenant', 57500, 'Age Pension'),
  ('HH-1013', 'Jordan Clarke', 27, 'tenant', 39500, 'JobSeeker'),
  ('HH-1015', 'Leanne Foster', 40, 'tenant', 70000, 'Wages'),
  ('HH-1015', 'Kyle Foster', 18, 'other', 28000, 'Youth Allowance'),
  ('HH-1015', 'Zoe Foster', 13, 'child', 0, null),
  ('HH-1016', 'Tui Ngata', 33, 'tenant', 64000, 'Wages'),
  ('HH-1016', 'Ari Ngata', 5, 'child', 0, null),
  ('HH-1017', 'Ray Simmons', 63, 'tenant', 57500, 'Disability Support Pension'),
  ('HH-1018', 'Christine Ward', 69, 'tenant', 57500, 'Age Pension'),
  ('HH-1019', 'Wiremu Tane', 52, 'tenant', 44000, 'Jobseeker Support'),
  ('HH-1020', 'Hana Kereama', 29, 'tenant', 61000, 'Sole Parent Support'),
  ('HH-1020', 'Nikau Kereama', 6, 'child', 0, null),
  ('HH-1021', 'Fiona Grey', 70, 'tenant', 54000, 'NZ Super'),
  ('HH-1021', 'Tom Grey', 72, 'partner', 54000, 'NZ Super'),
  ('HH-1022', 'Malakai Vea', 44, 'tenant', 98000, 'Wages'),
  ('HH-1022', 'Sela Vea', 41, 'partner', 30000, 'Wages')
) as x(ref, name, age, rel, income, src)
join households h on h.ref = x.ref
where not exists (select 1 from members m where m.household_id = h.id and m.name = x.name);

-- Tenancies. Offsets are days from today; null is not yet. Rent is set from the policy below.
insert into tenancies (number, household_id, property_id, kind, started_on, rent_cents, income_checked_on, arrears_notice_on, ended_on, end_reason)
select x.number, h.id, p.id, x.kind, current_date + x.started, 0, current_date + x.checked, current_date + x.notice, current_date + x.ended, x.reason
from (values
  ('T-1001', 'HH-1001', 'PR-101', 'periodic', -2400, -150, null::int, null::int, null),
  ('T-1002', 'HH-1002', 'PR-102', 'periodic', -270, -270, null, null, null),
  ('T-1003', 'HH-1003', 'PR-103', 'periodic', -1500, -420, null, null, null),
  ('T-1004', 'HH-1004', 'PR-104', 'fixed term', -620, -200, null, null, null),
  ('T-1005', 'HH-1005', 'PR-105', 'periodic', -1900, -90, null, null, null),
  ('T-1006', 'HH-1006', 'PR-106', 'periodic', -3100, -380, null, null, null),
  ('T-1007', 'HH-1007', 'PR-107', 'periodic', -900, -60, null, null, null),
  ('T-0908', 'HH-1008', 'PR-108', 'periodic', -1300, -500, null, -45, 'moved on'),
  ('T-0902', 'HH-1023', 'PR-102', 'periodic', -2200, -600, null, -300, 'transfer'),
  ('T-1009', 'HH-1009', 'GL-201', 'periodic', -1100, -120, null, null, null),
  ('T-1010', 'HH-1010', 'GL-202', 'periodic', -700, -300, null, null, null),
  ('T-1011', 'HH-1011', 'GL-203', 'periodic', -450, -180, null, null, null),
  ('T-1012', 'HH-1012', 'GL-204', 'periodic', -2600, -30, null, null, null),
  ('T-1013', 'HH-1013', 'GL-205', 'fixed term', -330, -330, null, null, null),
  ('T-0914', 'HH-1014', 'GL-206', 'periodic', -800, -400, null, -10, 'terminated for arrears'),
  ('T-1015', 'HH-1015', 'LG-301', 'periodic', -1250, -100, null, null, null),
  ('T-1016', 'HH-1016', 'LG-302', 'periodic', -480, -240, null, null, null),
  ('T-1017', 'HH-1017', 'LG-303', 'periodic', -2000, -400, null, null, null),
  ('T-1018', 'HH-1018', 'LG-304', 'periodic', -1600, -150, null, null, null),
  ('T-0925', 'HH-1025', 'LG-305', 'periodic', -3000, -500, null, -120, 'deceased'),
  ('T-0924', 'HH-1024', 'LG-301', 'periodic', -2400, -1300, null, -1290, 'abandoned'),
  ('T-1019', 'HH-1019', 'CH-401', 'periodic', -1400, -200, -10, null, null),
  ('T-1020', 'HH-1020', 'CH-402', 'periodic', -600, -150, null, null, null),
  ('T-1021', 'HH-1021', 'CH-403', 'periodic', -2100, -330, null, null, null),
  ('T-1022', 'HH-1022', 'CH-404', 'periodic', -1000, -90, null, null, null)
) as x(number, ref, property, kind, started, checked, notice, ended, reason)
join households h on h.ref = x.ref join properties p on p.code = x.property
on conflict (number) do nothing;

-- Rent as the policy sets it for current formula tenancies; MSD-assessed rent for the NZ homes.
update tenancies t set rent_cents = ra.policy_rent_cents from v_rent_assessment ra
where ra.tenancy_id = t.id and ra.method = 'formula' and t.rent_cents = 0;
update tenancies t set rent_cents = x.rent from (values ('T-1019', 11000), ('T-1020', 15250), ('T-1021', 27000), ('T-1022', 63500)) as x(number, rent)
where t.number = x.number and t.rent_cents = 0;
update tenancies t set rent_cents = x.rent from (values ('T-0908', 21000), ('T-0902', 19500), ('T-0914', 16500), ('T-0925', 23000), ('T-0924', 18000)) as x(number, rent)
where t.number = x.number and t.rent_cents = 0;
-- Deliberate problem: Ahmad's rent went up at his last review and was never brought down when he lost his job.
update tenancies set rent_cents = 24500 where number = 'T-1004' and rent_cents < 24500;
-- Joyce's pension has been indexed twice since her last review, so she is paying less than the policy says.
update tenancies set rent_cents = 21500 where number = 'T-1006' and rent_cents > 21500;

-- Rent changes on record. Kerry Walsh's increase went out with 30 days' notice, not 60.
insert into rent_changes (tenancy_id, effective_on, old_rent_cents, rent_cents, assessed_cents, market_cents, notice_on, reason)
select t.id, current_date + x.eff, x.old, coalesce(x.new, t.rent_cents), coalesce(x.new, t.rent_cents), p.market_rent_cents, current_date + x.notice, x.reason
from (values
  ('T-1009', -90, 21500, null::int, -120, 'income review'),
  ('T-1005', -60, 30500, null, -125, 'income review'),
  ('T-1015', -70, 28800, null, -140, 'income review'),
  ('T-1004', -200, 20000, 24500, -265, 'income review'),
  ('T-1022', -60, 61000, null, -125, 'MSD reassessment')
) as x(number, eff, old, new, notice, reason)
join tenancies t on t.number = x.number join properties p on p.id = t.property_id
where not exists (select 1 from rent_changes rc where rc.tenancy_id = t.id and rc.reason = x.reason and rc.old_rent_cents = x.old);

-- The ledger: a rent charge every week for the last six months, and payments, except where someone has fallen behind.
-- missed = weeks unpaid at the end. Daniel is three weeks behind (NSW, past 14 days), Jordan three (VIC, past 14 days, no notice),
-- Ray two (QLD, past 7), Wiremu four (NZ, notice served ten days ago), Graham one, and Nathan left owing six.
with t as (
  select t.id, t.rent_cents, t.started_on, coalesce(t.ended_on, current_date) as last_day, coalesce(x.missed, 0) as missed
  from tenancies t left join (values ('T-1002', 3), ('T-1013', 3), ('T-1017', 2), ('T-1019', 4), ('T-1010', 1), ('T-0914', 6)) as x(number, missed) on x.number = t.number
  where coalesce(t.ended_on, current_date) >= current_date - 200
), weeks as (
  select t.id, t.rent_cents, t.missed, d::date as posted_on,
    row_number() over (partition by t.id order by d desc) as from_end
  from t, generate_series(greatest(t.started_on, current_date - 182)::timestamp, t.last_day::timestamp, interval '7 days') d
)
insert into ledger (tenancy_id, posted_on, kind, amount_cents, reference)
select id, posted_on, 'rent', rent_cents, 'Weekly rent' from weeks
on conflict do nothing;

insert into ledger (tenancy_id, posted_on, kind, amount_cents, reference)
select l.tenancy_id, l.posted_on, 'payment', -l.amount_cents, 'Centrepay'
from (
  select l.*, row_number() over (partition by l.tenancy_id order by l.posted_on desc) as from_end
  from ledger l where l.kind = 'rent'
) l
join tenancies t on t.id = l.tenancy_id
left join (values ('T-1002', 3), ('T-1013', 3), ('T-1017', 2), ('T-1019', 4), ('T-1010', 1), ('T-0914', 6)) as x(number, missed) on x.number = t.number
where l.from_end > coalesce(x.missed, 0)
  and not exists (select 1 from ledger p where p.tenancy_id = l.tenancy_id and p.kind = 'payment' and p.posted_on = l.posted_on);

-- Repairs. Offsets are days from today.
insert into repairs (number, property_id, tenancy_id, reported_on, priority, category, description, contractor, done_on, cost_cents, tenant_damage)
select x.number, p.id, (select t.id from tenancies t where t.property_id = p.id and t.ended_on is null), current_date + x.reported, x.priority, x.category, x.description,
  x.contractor, current_date + x.done, x.cost, x.damage
from (values
  ('RQ-2001', 'PR-103', -3, 'urgent', 'plumbing', 'Hot water system leaking, no hot water', 'Nepean Plumbing (demo)', null::int, null::int, false),
  ('RQ-2002', 'GL-203', -40, 'routine', 'doors and windows', 'Back door sticks and will not lock', 'Corio Handyman (demo)', null, null, false),
  ('RQ-2003', 'LG-302', -35, 'routine', 'electrical', 'Two kitchen power points not working', null, null, null, false),
  ('RQ-2004', 'PR-108', -40, 'priority', 'void works', 'Repaint, new carpet in bedrooms, replace oven before reletting', 'Penrith Maintenance Group (demo)', null, null, false),
  ('RQ-2005', 'CH-402', -12, 'priority', 'healthy homes', 'Install extractor fan in bathroom and kitchen rangehood', 'Linwood Electrical (demo)', null, null, false),
  ('RQ-2006', 'PR-105', -150, 'routine', 'plumbing', 'Dripping laundry tap', 'Nepean Plumbing (demo)', -140, 18500, false),
  ('RQ-2007', 'GL-201', -120, 'urgent', 'gas', 'Smell of gas near heater', 'Geelong Gas Fitting (demo)', -120, 42000, false),
  ('RQ-2008', 'LG-301', -200, 'routine', 'doors and windows', 'Broken bedroom window', 'Logan Glass (demo)', -170, 36000, true),
  ('RQ-2009', 'CH-404', -90, 'priority', 'heating', 'Heat pump not heating', 'Linwood Electrical (demo)', -86, 64000, false),
  ('RQ-2010', 'PR-107', -60, 'routine', 'grounds', 'Overgrown tree over the driveway', 'Western Trees (demo)', -20, 52000, false),
  ('RQ-2011', 'GL-206', -8, 'priority', 'void works', 'Clean, patch walls and replace blinds', 'Corio Handyman (demo)', -2, 145000, false),
  ('RQ-2012', 'LG-305', -110, 'planned', 'major works', 'Kitchen and bathroom replacement before reletting', 'Logan Builders (demo)', null, null, false),
  ('RQ-2013', 'PR-101', -300, 'priority', 'accessibility', 'Grab rails in shower', 'Penrith Maintenance Group (demo)', -296, 38000, false),
  ('RQ-2014', 'CH-401', -6, 'routine', 'plumbing', 'Toilet cistern running', null, null, null, false)
) as x(number, property, reported, priority, category, description, contractor, done, cost, damage)
join properties p on p.code = x.property
on conflict (number) do nothing;

-- Safety checks and inspections. Most are current; a few are deliberately overdue or missing.
insert into inspections (property_id, kind, done_on, done_by, result, note)
select p.id, x.kind, current_date + x.done, x.by, x.result, x.note
from (values
  ('PR-101', 'smoke alarm', -120, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-102', 'smoke alarm', -275, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-103', 'smoke alarm', -400, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-104', 'smoke alarm', -200, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-105', 'smoke alarm', -90, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-106', 'smoke alarm', -350, 'Alarm Check NSW (demo)', 'pass', null),
  ('PR-107', 'smoke alarm', -60, 'Alarm Check NSW (demo)', 'issues', 'Replaced one alarm in hallway'),
  ('GL-201', 'smoke alarm', -100, 'Barwon Safety (demo)', 'pass', null),
  ('GL-202', 'smoke alarm', -180, 'Barwon Safety (demo)', 'pass', null),
  ('GL-203', 'smoke alarm', -150, 'Barwon Safety (demo)', 'pass', null),
  ('GL-204', 'smoke alarm', -40, 'Barwon Safety (demo)', 'pass', null),
  ('GL-205', 'smoke alarm', -300, 'Barwon Safety (demo)', 'pass', null),
  ('GL-201', 'gas', -760, 'Geelong Gas Fitting (demo)', 'pass', null),
  ('GL-203', 'gas', -300, 'Geelong Gas Fitting (demo)', 'pass', null),
  ('GL-205', 'gas', -400, 'Geelong Gas Fitting (demo)', 'pass', null),
  ('GL-201', 'electrical', -300, 'Bay Electrical (demo)', 'pass', null),
  ('GL-202', 'electrical', -300, 'Bay Electrical (demo)', 'pass', null),
  ('GL-204', 'electrical', -500, 'Bay Electrical (demo)', 'pass', null),
  ('GL-205', 'electrical', -720, 'Bay Electrical (demo)', 'pass', null),
  ('LG-301', 'smoke alarm', -100, 'Logan Fire Safety (demo)', 'pass', null),
  ('LG-303', 'smoke alarm', -200, 'Logan Fire Safety (demo)', 'pass', null),
  ('LG-304', 'smoke alarm', -260, 'Logan Fire Safety (demo)', 'pass', null),
  ('CH-401', 'smoke alarm', -150, 'Canterbury Alarms (demo)', 'pass', null),
  ('CH-402', 'smoke alarm', -100, 'Canterbury Alarms (demo)', 'pass', null),
  ('CH-403', 'smoke alarm', -200, 'Canterbury Alarms (demo)', 'pass', null),
  ('CH-404', 'smoke alarm', -90, 'Canterbury Alarms (demo)', 'pass', null),
  ('CH-401', 'healthy homes', -800, 'Warm Homes Assessors (demo)', 'pass', null),
  ('CH-403', 'healthy homes', -700, 'Warm Homes Assessors (demo)', 'pass', null),
  ('CH-404', 'healthy homes', -750, 'Warm Homes Assessors (demo)', 'pass', null),
  ('CH-402', 'healthy homes', -30, 'Warm Homes Assessors (demo)', 'fail', 'Ventilation: no extractor fans'),
  ('PR-101', 'routine', -150, 'Housing officer', 'pass', null),
  ('PR-102', 'entry', -270, 'Housing officer', 'pass', null),
  ('PR-103', 'routine', -420, 'Housing officer', 'issues', 'Hot water system old'),
  ('PR-104', 'routine', -200, 'Housing officer', 'pass', null),
  ('PR-105', 'routine', -90, 'Housing officer', 'pass', null),
  ('PR-106', 'routine', -380, 'Housing officer', 'pass', null),
  ('PR-107', 'routine', -60, 'Housing officer', 'pass', null),
  ('GL-201', 'routine', -120, 'Housing officer', 'pass', null),
  ('GL-202', 'routine', -300, 'Housing officer', 'pass', null),
  ('GL-203', 'entry', -450, 'Housing officer', 'pass', null),
  ('GL-204', 'routine', -30, 'Housing officer', 'pass', null),
  ('GL-205', 'entry', -330, 'Housing officer', 'pass', null),
  ('LG-301', 'routine', -100, 'Housing officer', 'pass', null),
  ('LG-302', 'entry', -480, 'Housing officer', 'pass', null),
  ('LG-303', 'routine', -400, 'Housing officer', 'pass', null),
  ('LG-304', 'routine', -150, 'Housing officer', 'pass', null),
  ('CH-401', 'routine', -200, 'Tenancy manager', 'pass', null),
  ('CH-402', 'routine', -150, 'Tenancy manager', 'issues', 'Damp in bathroom'),
  ('CH-403', 'routine', -330, 'Tenancy manager', 'pass', null),
  ('CH-404', 'routine', -90, 'Tenancy manager', 'pass', null)
) as x(property, kind, done, by, result, note)
join properties p on p.code = x.property
where not exists (select 1 from inspections i where i.property_id = p.id and i.kind = x.kind and i.done_on = current_date + x.done);

-- The waiting list.
insert into applicants (ref, name, phone, email, people, bedrooms_needed, needs_accessible, areas, band, register_ref, listed_on, last_contact_on, status, note)
values
  ('AP-3001', 'Sharon Doyle', '0412 555 301', null, 3, 2, false, 'Penrith, St Marys, Werrington', 'priority', 'NSW-HR-88123', current_date - 210, current_date - 30, 'waiting', 'Escaping family violence, supported by refuge'),
  ('AP-3002', 'Brian Toohey', '0412 555 302', null, 1, 1, true, 'Penrith, St Marys', 'priority', 'NSW-HR-77310', current_date - 400, current_date - 60, 'waiting', 'Uses a wheelchair'),
  ('AP-3003', 'Nguyen Family', '0412 555 303', null, 5, 4, false, 'Mount Druitt, Blacktown', 'general', 'NSW-HR-61002', current_date - 900, current_date - 420, 'waiting', null),
  ('AP-3004', 'Elena Petrova', '0412 555 304', null, 2, 2, false, 'Penrith', 'general', 'NSW-HR-70221', current_date - 650, current_date - 380, 'waiting', null),
  ('AP-3005', 'Kevin Marsh', '0412 555 305', null, 2, 2, false, 'Geelong West, South Geelong, Corio', 'priority', 'VIC-VHR-44120', current_date - 160, current_date - 9, 'offered', null),
  ('AP-3006', 'Priya Sharma', '0412 555 306', null, 1, 1, false, 'Geelong', 'general', 'VIC-VHR-39981', current_date - 500, current_date - 100, 'waiting', null),
  ('AP-3007', 'Lena Ruiz', '0412 555 307', null, 4, 3, false, 'Logan Central, Kingston, Slacks Creek', 'general', 'QLD-HR-55012', current_date - 300, current_date - 45, 'waiting', null),
  ('AP-3008', 'Hemi Walker', '021 555 308', null, 1, 0, false, 'Linwood, Phillipstown, Christchurch', 'priority', 'MSD-HR-120998', current_date - 90, current_date - 14, 'waiting', null),
  ('AP-3009', 'Aroha Davis', '021 555 309', null, 1, 1, false, 'Christchurch', 'general', 'MSD-HR-118340', current_date - 420, current_date - 400, 'waiting', null),
  ('AP-3010', 'Paul and Jan Ellis', '0412 555 310', null, 2, 2, false, 'Penrith, Werrington', 'transfer', null, current_date - 120, current_date - 20, 'waiting', 'Current tenants elsewhere, asking to move closer to family'),
  ('AP-3011', 'Grant Hughes', '0412 555 311', null, 1, 1, false, 'Geelong', 'general', 'VIC-VHR-30110', current_date - 700, current_date - 300, 'housed', null)
on conflict (ref) do nothing;

insert into offers (applicant_id, property_id, offered_on, response, responded_on, reason)
select a.id, p.id, current_date + x.offered, x.response, current_date + x.responded, x.reason
from (values
  ('AP-3005', 'GL-206', -9, 'pending', null::int, null),
  ('AP-3006', 'GL-206', -40, 'declined', -35, 'Too far from work'),
  ('AP-3004', 'PR-102', -285, 'declined', -282, 'Wanted ground floor'),
  ('AP-3009', 'CH-405', -15, 'no response', -8, 'Three calls, no answer')
) as x(ref, property, offered, response, responded, reason)
join applicants a on a.ref = x.ref join properties p on p.code = x.property
where not exists (select 1 from offers o where o.applicant_id = a.id and o.property_id = p.id);

insert into complaints (number, household_id, applicant_id, kind, category, received_on, summary, responded_on, outcome)
select x.number, h.id, a.id, x.kind, x.category, current_date + x.received, x.summary, current_date + x.responded, x.outcome
from (values
  ('CP-0401', 'HH-1003', null, 'complaint', 'repairs', -20, 'Hot water repair took three weeks last time', null::int, null),
  ('CP-0402', 'HH-1011', null, 'complaint', 'repairs', -9, 'Back door still not fixed', null, null),
  ('CP-0403', null, 'AP-3004', 'appeal', 'allocation', -60, 'Appeal against priority band decision', -50, 'Band confirmed, reasons sent in writing'),
  ('CP-0404', 'HH-1012', null, 'compliment', 'staff', -15, 'Thanks to the housing officer for help with the move', null, null),
  ('CP-0405', 'HH-1019', null, 'complaint', 'rent', -30, 'Disputes the rent arrears amount', -18, 'Ledger walked through with tenant, arrears plan agreed')
) as x(number, ref, aref, kind, category, received, summary, responded, outcome)
left join households h on h.ref = x.ref left join applicants a on a.ref = x.aref
on conflict (number) do nothing;

insert into notes (household_id, tenancy_id, title, body)
select h.id, t.id, x.title, x.body
from (values
  ('HH-1002', 'T-1002', 'Phone call', 'Daniel says his hours were cut at the warehouse. Asked for payslips to reassess rent.'),
  ('HH-1019', 'T-1019', 'Arrears plan', 'Agreed NZ$20 a week extra from next benefit day. Notice served 10 days ago.')
) as x(ref, number, title, body)
join households h on h.ref = x.ref join tenancies t on t.number = x.number
where not exists (select 1 from notes n where n.household_id = h.id and n.title = x.title);
