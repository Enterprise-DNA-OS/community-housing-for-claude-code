-- Community Housing for Claude Code: the records of a community housing provider.
-- Properties and the programs that fund them, households and the people in them, tenancies,
-- income-based rent assessments, the rent ledger, repairs, safety checks and inspections,
-- the waiting list and offers, complaints and appeals, and notes.
-- Plain Postgres. Runs on any Postgres and on the embedded PGlite. No extensions.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Business-wide settings the checks read. One row. Each rule's source is in docs/compliance.md.
create table settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Your community housing provider',
  review_months int not null default 12,             -- income and eligibility review cycle from your rent policy
  rent_notice_days int not null default 60,          -- NSW RTA 2010 s 41, Vic RTA 1997 s 44, NZ RTA 1986 s 24: 60 days written notice
  qld_rent_notice_days int not null default 61,      -- Qld RTRAA 2008 s 91: at least two months
  nsw_arrears_days int not null default 14,          -- NSW RTA 2010 s 88
  vic_arrears_days int not null default 14,          -- Vic RTA 1997 s 91ZM
  qld_arrears_days int not null default 7,           -- Qld RTRAA 2008 s 325 (notice to remedy breach)
  nz_arrears_days int not null default 21,           -- NZ RTA 1986 s 55(1)(a)
  smoke_months int not null default 12,              -- NSW standard tenancy agreement (Residential Tenancies Regulation 2019 Sch 1) cl 42.2: once a year
  gas_months int not null default 24,                -- Vic Residential Tenancies Regulations 2021: every two years
  electrical_months int not null default 24,         -- Vic Residential Tenancies Regulations 2021: every two years
  inspection_months int not null default 12,         -- routine property inspection cycle
  urgent_days int not null default 1,                -- repair targets by priority
  priority_days int not null default 7,
  routine_days int not null default 28,
  planned_days int not null default 90,
  complaint_days int not null default 14,            -- respond to a complaint or appeal within this many days
  void_target_days int not null default 28,          -- keys back to the next tenancy
  offer_days int not null default 7,                 -- an offer with no answer after this long needs a call
  waitlist_contact_days int not null default 365,    -- applicants not contacted in this long need their details confirmed
  warn_days int not null default 30,                 -- how far ahead a due date shows on attention
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- How rent is set. 'formula': a share of household income plus CRA, capped at market rent
-- (the NSW Community Housing Rent Policy and Queensland's community housing rent policy work this way).
-- 'external': the rent is assessed outside the provider (NZ income-related rent is assessed by MSD),
-- so the system records it and checks it against market rent only.
create table rent_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'NZ')),
  method text not null default 'formula' check (method in ('formula', 'external')),
  adult_pct numeric(5, 2) not null default 25,       -- tenant, partner and every member aged 21 or over
  young_adult_pct numeric(5, 2) not null default 15, -- members aged 18 to 20 who are not the tenant or partner
  ftb_pct numeric(5, 2) not null default 15,         -- Family Tax Benefit A and B
  cra_pct numeric(5, 2) not null default 100,        -- Commonwealth Rent Assistance
  market_cap boolean not null default true,          -- never charge more than market rent
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'social' check (kind in ('social', 'affordable', 'transitional', 'crisis', 'disability', 'seniors')),
  funder text,
  rent_policy_id uuid not null references rent_policies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                          -- e.g. PR-104
  address text not null,
  suburb text not null,
  region text,
  jurisdiction text not null check (jurisdiction in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'NZ')),
  currency text not null default 'AUD',
  dwelling text not null default 'unit' check (dwelling in ('house', 'townhouse', 'unit', 'apartment', 'studio', 'boarding room')),
  bedrooms int not null default 1 check (bedrooms between 0 and 8),
  accessible boolean not null default false,
  has_gas boolean not null default false,
  ownership text not null default 'owned' check (ownership in ('owned', 'leased from government', 'head-leased', 'managed for owner')),
  program_id uuid not null references programs(id),
  market_rent_cents int not null check (market_rent_cents >= 0),   -- weekly
  offline boolean not null default false,            -- held back from letting (major works, sale, handback)
  available_since date,                              -- first available date for a property never let
  note text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                          -- e.g. HH-1007
  name text not null,                                -- the lead tenant
  phone text,
  email text,
  support_provider text,                             -- the agency supporting the tenancy, if any
  support_worker text,
  cra_weekly_cents int not null default 0,           -- Commonwealth Rent Assistance entitlement
  ftb_weekly_cents int not null default 0,           -- Family Tax Benefit A and B paid fortnightly, weekly figure
  note text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  born_on date,
  relationship text not null default 'other' check (relationship in ('tenant', 'partner', 'child', 'other')),
  income_weekly_cents int not null default 0,
  income_source text,                                -- e.g. Age Pension, JobSeeker, wages
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenancies (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                       -- e.g. T-1007
  household_id uuid not null references households(id),
  property_id uuid not null references properties(id),
  kind text not null default 'periodic' check (kind in ('periodic', 'fixed term')),
  started_on date not null,
  fixed_until date,
  rent_cents int not null check (rent_cents >= 0),   -- weekly rent charged now
  income_checked_on date,                            -- last income and eligibility review
  arrears_notice_on date,                            -- last arrears notice served
  ended_on date,
  end_reason text check (end_reason in ('moved on', 'transfer', 'abandoned', 'terminated for arrears', 'terminated other', 'deceased', 'bought a home')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);
create unique index tenancies_one_current on tenancies (property_id) where ended_on is null;

-- Every rent setting, with what the policy said at the time and when notice went.
create table rent_changes (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  effective_on date not null,
  old_rent_cents int,
  rent_cents int not null,
  assessed_cents int,
  market_cents int,
  notice_on date,
  reason text not null default 'income review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The rent ledger. Charges are positive, payments negative. Balance is the sum.
create table ledger (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references tenancies(id) on delete cascade,
  posted_on date not null,
  kind text not null check (kind in ('rent', 'payment', 'adjustment', 'water', 'repair charge', 'opening balance')),
  amount_cents int not null,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ledger_one_rent_a_week on ledger (tenancy_id, posted_on) where kind = 'rent';
create index ledger_tenancy on ledger (tenancy_id, posted_on);

create table repairs (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                       -- e.g. RQ-2041
  property_id uuid not null references properties(id),
  tenancy_id uuid references tenancies(id),
  reported_on date not null default current_date,
  priority text not null default 'routine' check (priority in ('urgent', 'priority', 'routine', 'planned')),
  category text not null default 'general',
  description text not null,
  contractor text,
  done_on date,
  cost_cents int,
  tenant_damage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  kind text not null check (kind in ('routine', 'smoke alarm', 'gas', 'electrical', 'healthy homes', 'entry', 'exit')),
  done_on date not null,
  done_by text,
  result text not null default 'pass' check (result in ('pass', 'issues', 'fail')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applicants (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                          -- e.g. AP-3012
  name text not null,
  phone text,
  email text,
  people int not null default 1,
  bedrooms_needed int not null default 1,
  needs_accessible boolean not null default false,
  areas text,                                        -- comma-separated suburbs or regions they will take
  band text not null default 'general' check (band in ('priority', 'general', 'transfer')),
  register_ref text,                                 -- the state or MSD register number
  listed_on date not null default current_date,
  last_contact_on date,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'housed', 'withdrawn', 'suspended')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id),
  property_id uuid not null references properties(id),
  offered_on date not null default current_date,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined', 'no response', 'withdrawn')),
  responded_on date,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                       -- e.g. CP-0412
  household_id uuid references households(id),
  applicant_id uuid references applicants(id),
  kind text not null default 'complaint' check (kind in ('complaint', 'appeal', 'compliment')),
  category text not null default 'general',
  received_on date not null default current_date,
  summary text not null,
  responded_on date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  property_id uuid references properties(id),
  tenancy_id uuid references tenancies(id),
  title text not null default 'Note',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['settings','rent_policies','programs','properties','households','members','tenancies','rent_changes','ledger','repairs','inspections','applicants','offers','complaints','notes'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Current tenancies with their property, household and policy.
create view v_tenancies as
select t.id as tenancy_id, t.number as tenancy, p.code as property, p.address, p.suburb, p.jurisdiction, p.currency, p.bedrooms,
  h.id as household_id, h.ref as household, h.name as lead_tenant, g.code as program, rp.code as policy, rp.method,
  t.kind, t.started_on, t.rent_cents, p.market_rent_cents, t.income_checked_on, t.arrears_notice_on, t.ended_on, t.end_reason,
  p.id as property_id, round((coalesce(t.ended_on, current_date) - t.started_on) / 365.25, 1) as years
from tenancies t join properties p on p.id = t.property_id join households h on h.id = t.household_id
join programs g on g.id = p.program_id join rent_policies rp on rp.id = g.rent_policy_id;

-- Each current household member, the share of their income the policy counts, and why.
create view v_member_rates as
select m.id as member_id, m.household_id, m.name, m.relationship, m.income_weekly_cents, m.income_source,
  extract(year from age(current_date, m.born_on))::int as age_years,
  case when m.relationship in ('tenant', 'partner') then 'tenant or partner'
       when m.born_on is null or age(current_date, m.born_on) >= interval '21 years' then 'adult 21 or over'
       when age(current_date, m.born_on) >= interval '18 years' then 'aged 18 to 20'
       else 'under 18, not assessed' end as band,
  rp.id as rent_policy_id,
  case when m.relationship in ('tenant', 'partner') or m.born_on is null or age(current_date, m.born_on) >= interval '21 years' then rp.adult_pct
       when age(current_date, m.born_on) >= interval '18 years' then rp.young_adult_pct else 0 end as pct
from members m
join tenancies t on t.household_id = m.household_id and t.ended_on is null
join properties p on p.id = t.property_id join programs g on g.id = p.program_id join rent_policies rp on rp.id = g.rent_policy_id
where m.left_on is null;

-- What the rent policy says each current tenancy should pay, against what it is charged.
create view v_rent_assessment as
select vt.tenancy_id, vt.tenancy, vt.property, vt.jurisdiction, vt.currency, vt.lead_tenant, vt.household_id, vt.policy, vt.method,
  coalesce(mi.income, 0)::int as household_income_cents,
  coalesce(mi.income_part, 0)::int as income_part_cents,
  round(h.ftb_weekly_cents * rp.ftb_pct / 100)::int as ftb_part_cents,
  round(h.cra_weekly_cents * rp.cra_pct / 100)::int as cra_part_cents,
  case when vt.method = 'external' then vt.rent_cents
       else (coalesce(mi.income_part, 0) + round(h.ftb_weekly_cents * rp.ftb_pct / 100) + round(h.cra_weekly_cents * rp.cra_pct / 100))::int end as assessed_cents,
  vt.market_rent_cents,
  case when vt.method = 'external' then least(vt.rent_cents, vt.market_rent_cents)
       when rp.market_cap then least(vt.market_rent_cents, (coalesce(mi.income_part, 0) + round(h.ftb_weekly_cents * rp.ftb_pct / 100) + round(h.cra_weekly_cents * rp.cra_pct / 100))::int)
       else (coalesce(mi.income_part, 0) + round(h.ftb_weekly_cents * rp.ftb_pct / 100) + round(h.cra_weekly_cents * rp.cra_pct / 100))::int end as policy_rent_cents,
  vt.rent_cents,
  vt.income_checked_on,
  (coalesce(vt.income_checked_on, vt.started_on) + make_interval(months => s.review_months))::date as review_due_on
from v_tenancies vt
join households h on h.id = vt.household_id
join rent_policies rp on rp.code = vt.policy
cross join settings s
left join (select household_id, sum(income_weekly_cents) as income, round(sum(income_weekly_cents * pct / 100)) as income_part from v_member_rates group by household_id) mi
  on mi.household_id = vt.household_id
where vt.ended_on is null;

-- Balance per tenancy. Days in arrears is the balance expressed in days of rent.
create view v_balances as
select vt.tenancy_id, vt.tenancy, vt.property, vt.jurisdiction, vt.currency, vt.lead_tenant, vt.household_id, vt.rent_cents, vt.ended_on, vt.arrears_notice_on,
  coalesce(b.balance, 0)::int as balance_cents,
  case when vt.rent_cents > 0 and coalesce(b.balance, 0) > 0 then floor(b.balance * 7.0 / vt.rent_cents)::int else 0 end as days_in_arrears,
  b.last_payment_on, b.last_payment_cents,
  case vt.jurisdiction when 'NSW' then s.nsw_arrears_days when 'VIC' then s.vic_arrears_days when 'QLD' then s.qld_arrears_days when 'NZ' then s.nz_arrears_days else 14 end as threshold_days
from v_tenancies vt cross join settings s
left join (
  select l.tenancy_id, sum(l.amount_cents) as balance,
    max(l.posted_on) filter (where l.kind = 'payment') as last_payment_on,
    (array_agg(-l.amount_cents order by l.posted_on desc) filter (where l.kind = 'payment'))[1] as last_payment_cents
  from ledger l group by l.tenancy_id) b on b.tenancy_id = vt.tenancy_id;

create view v_arrears as
select * from v_balances where balance_cents > 0 and (ended_on is null or balance_cents > 0) and days_in_arrears >= 1;

-- Properties with nobody living in them, how long, and the rent not coming in.
create view v_voids as
select p.id as property_id, p.code as property, p.address, p.suburb, p.jurisdiction, p.currency, p.bedrooms, p.dwelling, p.accessible, g.code as program,
  case when p.offline then 'offline' when exists (select 1 from offers o where o.property_id = p.id and o.response = 'pending') then 'offered'
       when exists (select 1 from repairs r where r.property_id = p.id and r.done_on is null) then 'void works' else 'ready to let' end as stage,
  coalesce(last.ended_on, p.available_since) as empty_since,
  (current_date - coalesce(last.ended_on, p.available_since))::int as days_empty,
  coalesce(last.rent_cents, p.market_rent_cents) as weekly_rent_cents,
  round(coalesce(last.rent_cents, p.market_rent_cents) * (current_date - coalesce(last.ended_on, p.available_since)) / 7.0)::int as rent_lost_cents,
  (select count(*) from repairs r where r.property_id = p.id and r.done_on is null)::int as open_repairs
from properties p join programs g on g.id = p.program_id
left join lateral (select t.ended_on, t.rent_cents from tenancies t where t.property_id = p.id order by t.ended_on desc nulls first limit 1) last on true
where not exists (select 1 from tenancies t where t.property_id = p.id and t.ended_on is null);

create view v_repairs as
select r.id as repair_id, r.number, p.code as property, p.suburb, p.jurisdiction, p.id as property_id, r.priority, r.category, r.description, r.contractor,
  r.reported_on,
  (r.reported_on + case r.priority when 'urgent' then s.urgent_days when 'priority' then s.priority_days when 'routine' then s.routine_days else s.planned_days end)::date as target_on,
  r.done_on, r.cost_cents, r.tenant_damage, p.currency,
  case when r.done_on is not null then 'done'
       when current_date > r.reported_on + case r.priority when 'urgent' then s.urgent_days when 'priority' then s.priority_days when 'routine' then s.routine_days else s.planned_days end then 'overdue'
       else 'open' end as state
from repairs r join properties p on p.id = r.property_id cross join settings s;

-- The last of each safety check and inspection per property, and when the next is due.
create view v_checks as
select p.id as property_id, p.code as property, p.suburb, p.jurisdiction, p.has_gas,
  exists (select 1 from tenancies t where t.property_id = p.id and t.ended_on is null) as tenanted,
  max(i.done_on) filter (where i.kind = 'smoke alarm') as smoke_on,
  (max(i.done_on) filter (where i.kind = 'smoke alarm') + make_interval(months => s.smoke_months))::date as smoke_due,
  max(i.done_on) filter (where i.kind = 'gas') as gas_on,
  (max(i.done_on) filter (where i.kind = 'gas') + make_interval(months => s.gas_months))::date as gas_due,
  max(i.done_on) filter (where i.kind = 'electrical') as electrical_on,
  (max(i.done_on) filter (where i.kind = 'electrical') + make_interval(months => s.electrical_months))::date as electrical_due,
  max(i.done_on) filter (where i.kind = 'healthy homes' and i.result = 'pass') as healthy_homes_on,
  max(i.done_on) filter (where i.kind in ('routine', 'entry')) as inspected_on,
  (max(i.done_on) filter (where i.kind in ('routine', 'entry')) + make_interval(months => s.inspection_months))::date as inspection_due
from properties p cross join settings s left join inspections i on i.property_id = p.id
where not p.offline
group by p.id, p.code, p.suburb, p.jurisdiction, p.has_gas, s.smoke_months, s.gas_months, s.electrical_months, s.inspection_months;

create view v_waitlist as
select a.id as applicant_id, a.ref, a.name, a.band, a.people, a.bedrooms_needed, a.needs_accessible, a.areas, a.listed_on,
  (current_date - a.listed_on)::int as days_waiting, a.last_contact_on,
  (current_date - coalesce(a.last_contact_on, a.listed_on))::int as days_since_contact, a.status, a.register_ref
from applicants a where a.status in ('waiting', 'offered', 'suspended');

create view v_complaints as
select c.id as complaint_id, c.number, c.kind, c.category, coalesce(h.name, a.name) as person, c.received_on,
  (c.received_on + s.complaint_days)::date as respond_by, c.responded_on, c.outcome, c.summary,
  case when c.kind = 'compliment' then 'noted' when c.responded_on is not null then 'responded'
       when current_date > c.received_on + s.complaint_days then 'overdue' else 'open' end as state
from complaints c left join households h on h.id = c.household_id left join applicants a on a.id = c.applicant_id cross join settings s;

-- Record checks. Each rule cites its source; docs/compliance.md explains it. Not legal advice.
create view v_compliance as
select 'RENT-ABOVE-POLICY' as rule, ra.property as record, ra.lead_tenant as who,
  format('Charged %s a week; the %s policy gives %s (income %s + FTB %s + CRA %s%s)', round(ra.rent_cents / 100.0, 2), ra.policy, round(ra.policy_rent_cents / 100.0, 2),
    round(ra.income_part_cents / 100.0, 2), round(ra.ftb_part_cents / 100.0, 2), round(ra.cra_part_cents / 100.0, 2),
    case when ra.policy_rent_cents < ra.assessed_cents then format(', capped at market %s', round(ra.market_rent_cents / 100.0, 2)) else '' end) as finding,
  current_date as due_date, 'Your rent policy; NSW Community Housing Rent Policy; Qld community housing rent policy' as source
from v_rent_assessment ra where ra.method = 'formula' and ra.rent_cents > ra.policy_rent_cents + 100
union all
select 'RENT-ABOVE-MARKET', ra.property, ra.lead_tenant,
  format('Charged %s a week against a market rent of %s', round(ra.rent_cents / 100.0, 2), round(ra.market_rent_cents / 100.0, 2)), current_date,
  'Your rent policy; income-related rent never exceeds market rent (Public and Community Housing Management Act 1992, NZ)'
from v_rent_assessment ra where ra.rent_cents > ra.market_rent_cents
union all
select 'INCOME-REVIEW', ra.property, ra.lead_tenant,
  format('Income last reviewed %s; review due %s', coalesce(ra.income_checked_on::text, 'never'), ra.review_due_on), ra.review_due_on,
  'Your rent policy (review cycle in settings); National Regulatory Code, Performance Outcome 1'
from v_rent_assessment ra cross join settings s where ra.review_due_on <= current_date + s.warn_days
union all
select 'RENT-NOTICE', vt.property, vt.lead_tenant,
  format('Rent rose from %s to %s on %s; %s', round(rc.old_rent_cents / 100.0, 2), round(rc.rent_cents / 100.0, 2), rc.effective_on,
    case when rc.notice_on is null then 'no notice recorded' else format('notice given %s, %s days before', rc.notice_on, rc.effective_on - rc.notice_on) end),
  rc.effective_on,
  case vt.jurisdiction when 'NSW' then 'Residential Tenancies Act 2010 (NSW) s 41' when 'VIC' then 'Residential Tenancies Act 1997 (Vic) s 44'
    when 'QLD' then 'Residential Tenancies and Rooming Accommodation Act 2008 (Qld) s 91' when 'NZ' then 'Residential Tenancies Act 1986 (NZ) s 24' else 'Your state residential tenancies Act' end
from rent_changes rc join v_tenancies vt on vt.tenancy_id = rc.tenancy_id cross join settings s
where rc.rent_cents > coalesce(rc.old_rent_cents, 0) and rc.old_rent_cents is not null and rc.effective_on >= current_date - 365
  and (rc.notice_on is null or rc.effective_on - rc.notice_on < case vt.jurisdiction when 'QLD' then s.qld_rent_notice_days else s.rent_notice_days end)
union all
select 'ARREARS-THRESHOLD', b.property, b.lead_tenant,
  format('%s days in arrears (%s owed); the %s threshold is %s days and no arrears notice is recorded in that time. Follow your arrears and sustaining tenancies policy first.',
    b.days_in_arrears, round(b.balance_cents / 100.0, 2), b.jurisdiction, b.threshold_days),
  current_date,
  case b.jurisdiction when 'NSW' then 'Residential Tenancies Act 2010 (NSW) s 88' when 'VIC' then 'Residential Tenancies Act 1997 (Vic) s 91ZM'
    when 'QLD' then 'Residential Tenancies and Rooming Accommodation Act 2008 (Qld) s 325' when 'NZ' then 'Residential Tenancies Act 1986 (NZ) s 55(1)(a)' else 'Your state residential tenancies Act' end
from v_balances b where b.ended_on is null and b.days_in_arrears >= b.threshold_days
  and (b.arrears_notice_on is null or b.arrears_notice_on < current_date - b.days_in_arrears)
union all
select 'SMOKE-ALARM', c.property, null,
  format('Smoke alarms last checked %s', coalesce(c.smoke_on::text, 'never')), coalesce(c.smoke_due, current_date),
  case c.jurisdiction when 'NSW' then 'Residential Tenancies Regulation 2019 (NSW) Sch 1, standard agreement cl 42.2' when 'NZ' then 'Residential Tenancies (Smoke Alarms and Insulation) Regulations 2016 (NZ)'
    when 'QLD' then 'Fire Services Act 1990 (Qld) Part 9A' when 'VIC' then 'Residential Tenancies Regulations 2021 (Vic), Schedule 4 safety-related activities' else 'Your state smoke alarm rules' end
from v_checks c cross join settings s where c.tenanted and (c.smoke_due is null or c.smoke_due <= current_date + s.warn_days)
union all
select 'VIC-GAS-CHECK', c.property, null, format('Gas safety check last done %s', coalesce(c.gas_on::text, 'never')), coalesce(c.gas_due, current_date),
  'Residential Tenancies Regulations 2021 (Vic): gas safety check every two years'
from v_checks c cross join settings s where c.jurisdiction = 'VIC' and c.has_gas and c.tenanted and (c.gas_due is null or c.gas_due <= current_date + s.warn_days)
union all
select 'VIC-ELECTRICAL-CHECK', c.property, null, format('Electrical safety check last done %s', coalesce(c.electrical_on::text, 'never')), coalesce(c.electrical_due, current_date),
  'Residential Tenancies Regulations 2021 (Vic): electrical safety check every two years'
from v_checks c cross join settings s where c.jurisdiction = 'VIC' and c.tenanted and (c.electrical_due is null or c.electrical_due <= current_date + s.warn_days)
union all
select 'NZ-HEALTHY-HOMES', c.property, null, 'No passed healthy homes assessment on record', date '2024-07-01',
  'Residential Tenancies (Healthy Homes Standards) Regulations 2019 (NZ): registered community housing providers from 1 July 2024'
from v_checks c where c.jurisdiction = 'NZ' and c.tenanted and c.healthy_homes_on is null
union all
select 'COMPLAINT-RESPONSE', vc.number, vc.person, format('%s received %s, no response recorded (%s)', initcap(vc.kind), vc.received_on, vc.category), vc.respond_by,
  'National Regulatory Code, Performance Outcome 1 (complaints and appeals); your complaints policy'
from v_complaints vc where vc.state = 'overdue';
