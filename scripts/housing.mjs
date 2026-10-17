#!/usr/bin/env node
// One CLI for the community housing database. Human tables by default, --json for machines.
//   node scripts/housing.mjs help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

// Writable fields per record kind. Anything else is rejected.
export const entities = {
  rent_policies: ['code', 'name', 'jurisdiction', 'method', 'adult_pct', 'young_adult_pct', 'ftb_pct', 'cra_pct', 'market_cap', 'note'],
  programs: ['code', 'name', 'kind', 'funder', 'rent_policy_id'],
  properties: ['code', 'address', 'suburb', 'region', 'jurisdiction', 'currency', 'dwelling', 'bedrooms', 'accessible', 'has_gas', 'ownership', 'program_id', 'market_rent_cents',
    'offline', 'available_since', 'note', 'external_id'],
  households: ['ref', 'name', 'phone', 'email', 'support_provider', 'support_worker', 'cra_weekly_cents', 'ftb_weekly_cents', 'note', 'external_id'],
  members: ['household_id', 'name', 'born_on', 'relationship', 'income_weekly_cents', 'income_source', 'left_on'],
  tenancies: ['number', 'household_id', 'property_id', 'kind', 'started_on', 'fixed_until', 'rent_cents', 'income_checked_on', 'arrears_notice_on', 'ended_on', 'end_reason', 'external_id'],
  repairs: ['number', 'property_id', 'tenancy_id', 'reported_on', 'priority', 'category', 'description', 'contractor', 'done_on', 'cost_cents', 'tenant_damage'],
  inspections: ['property_id', 'kind', 'done_on', 'done_by', 'result', 'note'],
  applicants: ['ref', 'name', 'phone', 'email', 'people', 'bedrooms_needed', 'needs_accessible', 'areas', 'band', 'register_ref', 'listed_on', 'last_contact_on', 'status', 'note'],
  offers: ['applicant_id', 'property_id', 'offered_on', 'response', 'responded_on', 'reason'],
  complaints: ['number', 'household_id', 'applicant_id', 'kind', 'category', 'received_on', 'summary', 'responded_on', 'outcome'],
  notes: ['household_id', 'property_id', 'tenancy_id', 'title', 'body'],
  settings: ['business_name', 'review_months', 'rent_notice_days', 'qld_rent_notice_days', 'nsw_arrears_days', 'vic_arrears_days', 'qld_arrears_days', 'nz_arrears_days', 'smoke_months',
    'gas_months', 'electrical_months', 'inspection_months', 'urgent_days', 'priority_days', 'routine_days', 'planned_days', 'complaint_days', 'void_target_days', 'offer_days',
    'waitlist_contact_days', 'warn_days'],
};
// Which columns a person uses to name a record, and which table a reference field points at.
const labels = { rent_policies: ['code', 'name'], programs: ['code', 'name'], properties: ['code', 'address'], households: ['ref', 'name'], members: ['name'], tenancies: ['number'],
  repairs: ['number'], inspections: ['kind'], applicants: ['ref', 'name'], offers: ['response'], complaints: ['number'], notes: ['title'], settings: ['business_name'] };
const refs = { rent_policy_id: 'rent_policies', program_id: 'programs', property_id: 'properties', household_id: 'households', tenancy_id: 'tenancies', applicant_id: 'applicants' };

const need = (v, msg) => { if (v === undefined || v === null || v === '' || v === true) throw Error(msg); return v; };
const entity = (v) => { if (!Object.hasOwn(entities, v)) throw Error(`Unknown kind ${v}. Choose ${Object.keys(entities).join(', ')}`); return v; };
const today = () => new Date().toISOString().slice(0, 10);
const settingsOf = async (db) => (await db.query('select * from settings'))[0];
const money = (cents) => (cents === null || cents === undefined ? '' : (Number(cents) / 100).toFixed(2));

export function parseArgs(args) {
  const pos = [], flags = {};
  for (const s of args) {
    if (s.startsWith('--')) { const i = s.indexOf('='); flags[s.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : s.slice(i + 1); }
    else pos.push(s);
  }
  return { pos, flags };
}

// Exact id or name first (case-insensitive), then id prefix or name fragment. One match or an error listing them.
export async function resolve(db, kind, value) {
  entity(kind);
  if (kind === 'settings') return (await db.query('select * from settings'))[0];
  need(value, `Specify a ${kind} name or id`);
  const keys = labels[kind];
  const exact = keys.map((k) => `lower(${k}::text)=lower($1)`).join(' or ');
  let rows = await db.query(`select * from ${kind} where id::text=$1 or ${exact}`, [String(value)]);
  if (!rows.length) rows = await db.query(`select * from ${kind} where starts_with(id::text,lower($1)) or ${keys.map((k) => `position(lower($1) in lower(${k}::text))>0`).join(' or ')} order by ${keys[0]}`, [String(value)]);
  if (rows.length !== 1) {
    const error = Error(rows.length ? `Ambiguous ${kind}: ${rows.slice(0, 12).map((r) => `${r.id} ${r[keys[0]]}`).join('; ')}${rows.length > 12 ? ` and ${rows.length - 12} more` : ''}` : `No ${kind} match: ${value}`);
    error.matches = rows.map((r) => ({ id: r.id, name: r[keys[0]] }));
    throw error;
  }
  return rows[0];
}

// A tenancy by its number, its property code (the current tenancy there) or the lead tenant's name.
async function tenancyOf(db, value) {
  need(value, 'Specify a tenancy number, property code or tenant name');
  const rows = await db.query(`select t.* from tenancies t join properties p on p.id=t.property_id join households h on h.id=t.household_id
    where lower(t.number)=lower($1) or (t.ended_on is null and (lower(p.code)=lower($1) or lower(h.ref)=lower($1) or lower(h.name)=lower($1)))`, [String(value)]);
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) throw Error(`Ambiguous tenancy: ${rows.map((r) => r.number).join(', ')}`);
  return resolve(db, 'tenancies', value);
}

export function cents(v, where = 'Amount') {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[$,\s]|NZD|AUD/gi, ''));
  if (!Number.isFinite(n)) throw Error(`${where}: "${v}" is not an amount`);
  return Math.round(n * 100);
}

function num(v, where) {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[%,\s]/g, ''));
  if (!Number.isFinite(n)) throw Error(`${where}: "${v}" is not a number`);
  return n;
}

export function toDate(v, where = 'Date') {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = s.match(/^(\d{1,2})[/-](\d{1,2}|[A-Za-z]{3})[/-](\d{2,4})/);
    if (d) {
      const mon = /^\d/.test(d[2]) ? d[2].padStart(2, '0') : String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(d[2].toLowerCase()) + 1).padStart(2, '0');
      m = [null, d[3].length === 2 ? `20${d[3]}` : d[3], mon, d[1].padStart(2, '0')];
    }
  }
  if (!m) throw Error(`${where}: "${s}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`);
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (Number.isNaN(Date.parse(iso + 'T00:00:00Z')) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`${where}: "${s}" is not a real date`);
  return iso;
}

export const insightQueries = [
  ['Which households are charged more than the rent policy says, and what does that add up to over a year?',
    `select property,lead_tenant,policy,round(rent_cents/100.0,2) as charged,round(policy_rent_cents/100.0,2) as policy_says,round((rent_cents-policy_rent_cents)/100.0,2) as over_a_week,
      round((rent_cents-policy_rent_cents)*52/100.0) as over_a_year,income_checked_on from v_rent_assessment where method='formula' and rent_cents>policy_rent_cents order by over_a_week desc`],
  ['Which households are charged less than the policy says, and how much rent is the provider missing?',
    `select property,lead_tenant,policy,round(rent_cents/100.0,2) as charged,round(policy_rent_cents/100.0,2) as policy_says,round((policy_rent_cents-rent_cents)*52/100.0) as missed_a_year,
      income_checked_on,review_due_on from v_rent_assessment where method='formula' and rent_cents<policy_rent_cents order by missed_a_year desc`],
  ['What are empty homes costing, and what is holding each one up?',
    `select v.property,v.suburb,v.bedrooms,v.stage,v.days_empty,round(v.rent_lost_cents/100.0) as rent_lost,v.open_repairs,
      (select string_agg(r.description,'; ') from repairs r where r.property_id=v.property_id and r.done_on is null) as waiting_on,
      (select count(*) from v_waitlist w where w.status='waiting' and w.bedrooms_needed<=v.bedrooms and w.bedrooms_needed>=v.bedrooms-1
        and (w.areas is null or position(lower(v.suburb) in lower(w.areas))>0))::int as applicants_who_fit
     from v_voids v order by rent_lost desc`],
  ['How long does each region take to relet a home, from keys back to the next tenancy?',
    `select p.region,count(*)::int as relets,round(avg(n.started_on-o.ended_on))::int as avg_days,min(n.started_on-o.ended_on) as fastest,max(n.started_on-o.ended_on) as slowest
     from tenancies n join tenancies o on o.property_id=n.property_id and o.ended_on is not null and o.ended_on<=n.started_on
      and not exists (select 1 from tenancies m where m.property_id=n.property_id and m.ended_on>o.ended_on and m.ended_on<=n.started_on)
     join properties p on p.id=n.property_id group by p.region order by avg_days desc`],
  ['Which households have paid less than they were charged over the last four weeks, before they reach the arrears threshold?',
    `select vt.property,vt.lead_tenant,vt.jurisdiction,round(sum(l.amount_cents) filter (where l.kind='rent')/100.0,2) as charged_4wk,
      round(-coalesce(sum(l.amount_cents) filter (where l.kind='payment'),0)/100.0,2) as paid_4wk,b.days_in_arrears,b.threshold_days
     from v_tenancies vt join ledger l on l.tenancy_id=vt.tenancy_id and l.posted_on>current_date-28 join v_balances b on b.tenancy_id=vt.tenancy_id
     where vt.ended_on is null group by vt.property,vt.lead_tenant,vt.jurisdiction,b.days_in_arrears,b.threshold_days
     having coalesce(-sum(l.amount_cents) filter (where l.kind='payment'),0)<sum(l.amount_cents) filter (where l.kind='rent') order by b.days_in_arrears desc`],
  ['How much of the weekly rent roll comes from Commonwealth Rent Assistance, by program?',
    `select vt.program,vt.currency,count(*)::int as tenancies,round(sum(ra.rent_cents)/100.0) as weekly_rent,round(sum(ra.cra_part_cents)/100.0) as weekly_cra,
      round(100.0*sum(ra.cra_part_cents)/nullif(sum(ra.rent_cents),0))::int as cra_pct_of_rent
     from v_rent_assessment ra join v_tenancies vt on vt.tenancy_id=ra.tenancy_id group by vt.program,vt.currency order by weekly_rent desc`],
  ['Which waiting applicants fit a home that is empty right now?',
    `select v.property,v.suburb,v.bedrooms,v.stage,w.ref,w.name,w.band,w.bedrooms_needed,w.days_waiting
     from v_voids v join v_waitlist w on w.status='waiting' and w.bedrooms_needed<=v.bedrooms and w.bedrooms_needed>=v.bedrooms-1
      and (not w.needs_accessible or v.accessible) and (w.areas is null or position(lower(v.suburb) in lower(w.areas))>0)
     where v.stage<>'offline' order by v.property,case w.band when 'priority' then 1 when 'transfer' then 2 else 3 end,w.days_waiting desc`],
  ['Which contractors are slowest against the repair target, and what have they cost in the last 12 months?',
    `select coalesce(contractor,'(not assigned)') as contractor,count(*)::int as jobs,count(*) filter (where state='overdue' or (done_on>target_on))::int as missed_target,
      round(avg(done_on-reported_on) filter (where done_on is not null),1) as avg_days,round(coalesce(sum(cost_cents),0)/100.0) as cost
     from v_repairs where reported_on>=current_date-365 group by 1 order by missed_target desc,avg_days desc nulls last`],
  ['Which tenancies ended owing rent, and how much do former tenants owe?',
    `select b.tenancy,b.lead_tenant,b.property,t.ended_on,t.end_reason,round(b.balance_cents/100.0,2) as owed,b.currency from v_balances b join tenancies t on t.id=b.tenancy_id
     where t.ended_on is not null and b.balance_cents>0 order by owed desc`],
  ['How long have people on the waiting list been waiting, by band and home size?',
    `select band,bedrooms_needed,count(*)::int as applicants,round(avg(days_waiting))::int as avg_days,max(days_waiting) as longest,
      count(*) filter (where days_since_contact>(select waitlist_contact_days from settings))::int as not_contacted_in_a_year from v_waitlist where status='waiting'
     group by band,bedrooms_needed order by band,bedrooms_needed`],
];

const reads = {
  policies: `select rp.id,rp.code,rp.name,rp.jurisdiction,rp.method,rp.adult_pct,rp.young_adult_pct,rp.ftb_pct,rp.cra_pct,rp.market_cap,rp.note from rent_policies rp order by rp.code`,
  programs: `select g.id,g.code,g.name,g.kind,g.funder,rp.code as policy,(select count(*) from properties p where p.program_id=g.id)::int as properties from programs g join rent_policies rp on rp.id=g.rent_policy_id order by g.code`,
  properties: `select p.id,p.code as property,p.address,p.suburb,p.jurisdiction,p.dwelling,p.bedrooms,g.code as program,round(p.market_rent_cents/100.0,2) as market_rent,
    coalesce((select h.name from tenancies t join households h on h.id=t.household_id where t.property_id=p.id and t.ended_on is null),case when p.offline then '(offline)' else '(empty)' end) as tenant
    from properties p join programs g on g.id=p.program_id order by p.code`,
  households: `select h.id,h.ref,h.name,h.phone,(select count(*) from members m where m.household_id=h.id and m.left_on is null)::int as people,t.property,h.support_provider,
    coalesce(t.tenancy,'(no current tenancy)') as tenancy from households h left join v_tenancies t on t.household_id=h.id and t.ended_on is null order by h.ref`,
  tenancies: `select tenancy_id as id,tenancy,property,suburb,lead_tenant,program,kind,started_on,round(rent_cents/100.0,2) as rent,round(market_rent_cents/100.0,2) as market,years,income_checked_on
    from v_tenancies where ended_on is null order by property`,
  rent: `select tenancy_id as id,tenancy,property,lead_tenant,policy,round(household_income_cents/100.0,2) as income,round(income_part_cents/100.0,2) as income_part,
    round(ftb_part_cents/100.0,2) as ftb_part,round(cra_part_cents/100.0,2) as cra_part,round(market_rent_cents/100.0,2) as market,round(policy_rent_cents/100.0,2) as policy_rent,
    round(rent_cents/100.0,2) as charged,round((rent_cents-policy_rent_cents)/100.0,2) as gap,currency from v_rent_assessment order by abs(rent_cents-policy_rent_cents) desc,property`,
  arrears: `select tenancy_id as id,tenancy,property,lead_tenant,jurisdiction,round(balance_cents/100.0,2) as owed,days_in_arrears,threshold_days,last_payment_on,arrears_notice_on,
    case when ended_on is not null then 'former tenant' when days_in_arrears>=threshold_days then 'past threshold' else 'behind' end as state,currency from v_arrears order by ended_on nulls first,days_in_arrears desc`,
  reviews: `select tenancy_id as id,tenancy,property,lead_tenant,income_checked_on,review_due_on,(review_due_on-current_date) as days_left,round(rent_cents/100.0,2) as charged,round(policy_rent_cents/100.0,2) as policy_rent
    from v_rent_assessment where method='formula' order by review_due_on`,
  voids: `select property_id as id,property,address,suburb,bedrooms,program,stage,empty_since,days_empty,round(rent_lost_cents/100.0) as rent_lost,open_repairs,currency from v_voids order by days_empty desc`,
  repairs: `select repair_id as id,number,property,priority,category,description,contractor,reported_on,target_on,state,done_on,round(cost_cents/100.0) as cost from v_repairs
    order by case state when 'overdue' then 1 when 'open' then 2 else 3 end,target_on`,
  checks: `select property_id as id,property,suburb,jurisdiction,tenanted,smoke_on,smoke_due,gas_on,gas_due,electrical_on,electrical_due,healthy_homes_on,inspected_on,inspection_due from v_checks order by property`,
  waitlist: `select applicant_id as id,ref,name,band,people,bedrooms_needed,needs_accessible,areas,listed_on,days_waiting,last_contact_on,days_since_contact,status from v_waitlist
    order by case band when 'priority' then 1 when 'transfer' then 2 else 3 end,days_waiting desc`,
  offers: `select o.id,p.code as property,a.ref,a.name,o.offered_on,o.response,o.responded_on,o.reason,(current_date-o.offered_on) as days from offers o join properties p on p.id=o.property_id
    join applicants a on a.id=o.applicant_id order by case o.response when 'pending' then 1 else 2 end,o.offered_on desc`,
  complaints: `select complaint_id as id,number,kind,category,person,received_on,respond_by,state,responded_on,outcome,summary from v_complaints order by case state when 'overdue' then 1 when 'open' then 2 else 3 end,received_on`,
  compliance: `select rule,record,who,finding,due_date,source from v_compliance order by due_date,rule`,
  settings: `select * from settings`,
};

// --field=value for writes. A *_cents field can be given in dollars without the suffix: --rent=245 sets rent_cents.
async function fieldValues(db, kind, f) {
  const allowed = entities[kind], out = {};
  for (const [k, raw] of Object.entries(f)) {
    if (['json', 'dry-run'].includes(k)) continue;
    let key = k.replaceAll('-', '_'), v = raw === 'null' ? null : raw;
    if (!allowed.includes(key) && allowed.includes(`${key}_cents`)) { key = `${key}_cents`; v = cents(v, `--${k}`); }
    if (!allowed.includes(key) && allowed.includes(`${key}_id`)) key = `${key}_id`;
    if (!allowed.includes(key)) throw Error(`${kind} has no field ${k}. Fields: ${allowed.join(', ')}`);
    if (refs[key] && v !== null && !/^[0-9a-f-]{36}$/i.test(String(v))) v = (await resolve(db, refs[key], v)).id;
    if (v === true) v = 'true';
    if ((key.endsWith('_on') || key.endsWith('_since') || key.endsWith('_until')) && v !== null) v = toDate(v, `--${k}`);
    out[key] = v;
  }
  return out;
}

// The rent working for one tenancy: every member's band and share, FTB and CRA, the cap.
async function assessment(db, t) {
  const ra = (await db.query('select * from v_rent_assessment where tenancy_id=$1', [t.id]))[0];
  if (!ra) throw Error(`${t.number} is not a current tenancy`);
  const members = await db.query('select name,relationship,age_years,band,income_weekly_cents,income_source,pct,round(income_weekly_cents*pct/100)::int as counted_cents from v_member_rates where household_id=$1 order by income_weekly_cents desc', [ra.household_id]);
  const h = (await db.query('select * from households where id=$1', [ra.household_id]))[0];
  const rp = (await db.query('select * from rent_policies where code=$1', [ra.policy]))[0];
  const working = ra.method === 'external'
    ? [{ line: 'Rent assessed outside the provider (MSD income-related rent)', amount: money(ra.rent_cents) }, { line: 'Market rent (the most that can be charged)', amount: money(ra.market_rent_cents) }]
    : [...members.map((m) => ({ line: `${m.name} (${m.band}): ${Number(m.pct)}% of ${money(m.income_weekly_cents)}${m.income_source ? ` ${m.income_source}` : ''}`, amount: money(m.counted_cents) })),
      { line: `Family Tax Benefit: ${Number(rp.ftb_pct)}% of ${money(h.ftb_weekly_cents)}`, amount: money(ra.ftb_part_cents) },
      { line: `Commonwealth Rent Assistance: ${Number(rp.cra_pct)}% of ${money(h.cra_weekly_cents)}`, amount: money(ra.cra_part_cents) },
      { line: 'Assessed rent', amount: money(ra.assessed_cents) },
      { line: `Market rent${rp.market_cap ? ' (cap)' : ''}`, amount: money(ra.market_rent_cents) },
      { line: 'Rent under the policy', amount: money(ra.policy_rent_cents) }];
  return { tenancy: ra.tenancy, property: ra.property, lead_tenant: ra.lead_tenant, policy: ra.policy, method: ra.method, currency: ra.currency, working,
    charged: money(ra.rent_cents), policy_rent: money(ra.policy_rent_cents), change_a_week: money(ra.policy_rent_cents - ra.rent_cents), income_checked_on: ra.income_checked_on, review_due_on: ra.review_due_on,
    _raw: ra };
}

export async function execute(db, args) {
  const { pos, flags: f } = parseArgs(args);
  const [cmd = 'help', sub, ...rest] = pos;
  if (cmd === 'help' || f.help) return {
    commands: ['policies', 'programs', 'properties', 'households', 'tenancies', 'rent', 'arrears', 'reviews', 'voids', 'repairs', 'checks', 'waitlist', 'offers', 'complaints', 'compliance',
      'attention', 'kpis', 'settings', 'property <code>', 'household <ref|name>', 'tenancy <number|property|name>', 'applicant <ref|name>', 'ledger <tenancy> [--weeks=12]', 'insights [1..10]',
      'show <kind> <name|id>', 'add <kind> --field=value', 'update <kind> <name|id> --field=value',
      'assess <tenancy> [--apply --effective=date --notice=date]', 'income <member> --weekly=dollars [--source=]', 'rent-run [--on=date] [--dry-run]',
      'pay <tenancy> --amount=dollars [--on=date] [--ref=]', 'charge <tenancy> --amount=dollars --kind=water|repair charge|adjustment [--on=date] [--note=]', 'notice <tenancy> [--on=date]',
      'request <property> <description> [--priority=urgent|priority|routine|planned] [--category=] [--contractor=]', 'done <repair> [--cost=dollars] [--on=date] [--tenant-damage]',
      'inspect <property> --kind=routine|smoke alarm|gas|electrical|healthy homes|entry|exit [--result=pass|issues|fail] [--on=date] [--by=] [--note=]',
      'apply <name> --bedrooms=n [--people=n --areas="A, B" --band=priority|general|transfer --register= --phone= --accessible]', 'contact <applicant> [--on=date] [--note=]',
      'match <property>', 'offer <property> --to=<applicant> [--on=date]', 'reply <applicant> --accepted|--declined|--no-response [--reason=] [--on=date]',
      'house <applicant> --property=<code> --on=date [--number=] [--rent=dollars]', 'end <tenancy> --on=date --reason="moved on"', 'complaint <household|applicant> <summary> [--kind=complaint|appeal|compliment] [--category=]',
      'resolve <complaint> --outcome="..." [--on=date]', 'log <household> <note>', 'import cx --file=tenancies.csv [--dry-run]', 'import balances --file=balances.csv [--on=date] [--dry-run]', 'export --out=backup.json',
      'weekly-review', 'draft-arrears <tenancy>', 'draft-rent-notice <tenancy>', 'draft-offer <applicant>', 'draft-review-request <tenancy>'],
    note: 'Reads accept --json. Money flags are dollars; *_cents fields are cents. Drafts go to drafts/ and are never sent. Record checks are not legal advice: docs/compliance.md.',
  };

  if (reads[cmd]) {
    let rows = await db.query(reads[cmd]);
    if (f.state && rows[0] && 'state' in rows[0]) rows = rows.filter((r) => r.state === f.state);
    return rows;
  }

  if (cmd === 'attention') {
    const s = await settingsOf(db);
    const q = (sql) => db.query(sql);
    const out = [];
    for (const r of await q(`select rule,record,who,finding,due_date from v_compliance`)) out.push({ item: `RULE ${r.rule}`, record: r.record, who: r.who || '', why: r.finding, due: r.due_date });
    for (const r of await q(`select * from v_arrears where ended_on is null and days_in_arrears>=7`))
      out.push({ item: 'ARREARS', record: r.property, who: r.lead_tenant, why: `${r.days_in_arrears} days behind, ${money(r.balance_cents)} owed, last paid ${r.last_payment_on || 'never'}`, due: today() });
    for (const r of await q(`select * from v_voids where stage<>'offline' and days_empty>=${s.void_target_days}`))
      out.push({ item: 'VOID LONG', record: r.property, who: '', why: `Empty ${r.days_empty} days (${r.stage}), ${money(r.rent_lost_cents)} rent lost`, due: today() });
    for (const r of await q(`select * from v_repairs where state='overdue'`))
      out.push({ item: 'REPAIR OVERDUE', record: r.property, who: r.contractor || '(not assigned)', why: `${r.number} ${r.priority}: ${r.description}, target ${r.target_on}`, due: r.target_on });
    for (const r of await q(`select o.offered_on,p.code,a.name from offers o join properties p on p.id=o.property_id join applicants a on a.id=o.applicant_id where o.response='pending' and o.offered_on<current_date-${s.offer_days}`))
      out.push({ item: 'OFFER NO ANSWER', record: r.code, who: r.name, why: `Offered ${r.offered_on}, no answer yet`, due: today() });
    for (const r of await q(`select * from v_complaints where state='open' and respond_by<=current_date+7`))
      out.push({ item: 'COMPLAINT DUE', record: r.number, who: r.person, why: `${r.summary}`, due: r.respond_by });
    for (const r of await q(`select * from v_waitlist where status='waiting' and days_since_contact>${s.waitlist_contact_days}`))
      out.push({ item: 'WAITLIST STALE', record: r.ref, who: r.name, why: `No contact in ${r.days_since_contact} days; confirm they still need housing`, due: today() });
    const rank = (i) => (i.startsWith('RULE') ? 0 : ['ARREARS', 'REPAIR OVERDUE', 'VOID LONG', 'OFFER NO ANSWER', 'COMPLAINT DUE', 'WAITLIST STALE'].indexOf(i) + 1);
    return out.sort((a, b) => rank(a.item) - rank(b.item) || String(a.due).localeCompare(String(b.due)));
  }

  if (cmd === 'kpis') {
    const one = async (sql) => (await db.query(sql))[0];
    const occ = await one(`select count(*) filter (where not offline)::int as lettable,count(*) filter (where exists (select 1 from tenancies t where t.property_id=p.id and t.ended_on is null))::int as tenanted from properties p`);
    const relet = await one(`select round(avg(n.started_on-o.ended_on))::int as d,count(*)::int as n from tenancies n join tenancies o on o.property_id=n.property_id and o.ended_on<=n.started_on
      and not exists (select 1 from tenancies m where m.property_id=n.property_id and m.ended_on>o.ended_on and m.ended_on<=n.started_on) where n.started_on>=current_date-365`);
    const arr = await one(`select coalesce(sum(b.balance_cents) filter (where b.balance_cents>0 and b.ended_on is null),0)::bigint as owed,(select sum(rent_cents)*52 from tenancies where ended_on is null)::bigint as roll from v_balances b`);
    const rep = await one(`select count(*) filter (where done_on is not null)::int as done,count(*) filter (where done_on is not null and done_on<=target_on)::int as on_time from v_repairs where reported_on>=current_date-365`);
    const cmp = await one(`select count(*) filter (where responded_on is not null)::int as done,count(*) filter (where responded_on is not null and responded_on<=respond_by)::int as on_time from v_complaints where kind<>'compliment' and received_on>=current_date-365`);
    const ended = await one(`select count(*)::int as n,count(*) filter (where end_reason in ('moved on','transfer','bought a home','deceased'))::int as planned,
      count(*) filter (where end_reason in ('terminated for arrears','terminated other','abandoned'))::int as failed from tenancies where ended_on>=current_date-365`);
    const chk = await one(`select count(*) filter (where tenanted)::int as homes,count(*) filter (where tenanted and smoke_due>current_date)::int as smoke_ok from v_checks`);
    const rev = await one(`select count(*)::int as n,count(*) filter (where review_due_on>current_date)::int as ok from v_rent_assessment where method='formula'`);
    const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : 'n/a');
    return [
      { measure: 'Occupancy', value: pct(occ.tenanted, occ.lettable), detail: `${occ.tenanted} of ${occ.lettable} lettable homes tenanted` },
      { measure: 'Days to relet (12 months)', value: relet.d ?? 'n/a', detail: `${relet.n} relet(s) started in the last 12 months` },
      { measure: 'Arrears as share of annual rent roll', value: arr.roll ? `${((100 * Number(arr.owed)) / Number(arr.roll)).toFixed(2)}%` : 'n/a', detail: `${money(arr.owed)} owed by current tenants` },
      { measure: 'Repairs done on time (12 months)', value: pct(rep.on_time, rep.done), detail: `${rep.on_time} of ${rep.done} completed repairs` },
      { measure: 'Complaints answered on time (12 months)', value: pct(cmp.on_time, cmp.done), detail: `${cmp.on_time} of ${cmp.done} answered` },
      { measure: 'Tenancies ended by failure (12 months)', value: pct(ended.failed, ended.n), detail: `${ended.failed} of ${ended.n} ended by arrears, termination or abandonment` },
      { measure: 'Smoke alarm checks current', value: pct(chk.smoke_ok, chk.homes), detail: `${chk.smoke_ok} of ${chk.homes} tenanted homes` },
      { measure: 'Income reviews current', value: pct(rev.ok, rev.n), detail: `${rev.ok} of ${rev.n} formula-rent tenancies` },
    ];
  }

  if (cmd === 'property') {
    const p = await resolve(db, 'properties', sub);
    return {
      property: (await db.query(reads.properties.replace('order by p.code', 'where p.id=$1'), [p.id]))[0],
      checks: (await db.query('select smoke_on,smoke_due,gas_on,gas_due,electrical_on,electrical_due,healthy_homes_on,inspected_on,inspection_due from v_checks where property_id=$1', [p.id]))[0] || {},
      tenancies: await db.query(`select tenancy,lead_tenant,started_on,ended_on,end_reason,round(rent_cents/100.0,2) as rent from v_tenancies where property_id=$1 order by started_on desc`, [p.id]),
      repairs: await db.query('select number,priority,description,reported_on,state,done_on from v_repairs where property_id=$1 order by reported_on desc limit 10', [p.id]),
      compliance: (await execute(db, ['compliance'])).filter((r) => r.record === p.code),
    };
  }

  if (cmd === 'household') {
    const h = await resolve(db, 'households', sub);
    return {
      household: h,
      members: await db.query(`select m.name,m.relationship,extract(year from age(current_date,m.born_on))::int as age,round(m.income_weekly_cents/100.0,2) as weekly_income,m.income_source
        from members m where m.household_id=$1 and m.left_on is null order by m.income_weekly_cents desc`, [h.id]),
      tenancies: await db.query('select tenancy,property,started_on,ended_on,round(rent_cents/100.0,2) as rent from v_tenancies where household_id=$1 order by started_on desc', [h.id]),
      balance: (await db.query('select round(balance_cents/100.0,2) as owed,days_in_arrears,last_payment_on from v_balances where household_id=$1 and ended_on is null', [h.id]))[0] || {},
      notes: await db.query('select title,body,created_at from notes where household_id=$1 order by created_at desc limit 10', [h.id]),
      complaints: await db.query('select c.number,c.kind,c.received_on,c.state,c.summary from v_complaints c join complaints x on x.id=c.complaint_id where x.household_id=$1', [h.id]),
    };
  }

  if (cmd === 'tenancy') {
    const t = await tenancyOf(db, sub);
    const vt = (await db.query('select tenancy,property,address,lead_tenant,program,policy,kind,started_on,ended_on,end_reason,round(rent_cents/100.0,2) as rent,income_checked_on,arrears_notice_on from v_tenancies where tenancy_id=$1', [t.id]))[0];
    return {
      ...vt,
      balance: (await db.query('select round(balance_cents/100.0,2) as owed,days_in_arrears,threshold_days,last_payment_on from v_balances where tenancy_id=$1', [t.id]))[0],
      rent_changes: await db.query('select effective_on,round(old_rent_cents/100.0,2) as old_rent,round(rent_cents/100.0,2) as new_rent,notice_on,reason from rent_changes where tenancy_id=$1 order by effective_on desc', [t.id]),
      assessment: t.ended_on ? null : (({ _raw, ...a }) => a)(await assessment(db, t)),
    };
  }

  if (cmd === 'applicant') {
    const a = await resolve(db, 'applicants', sub);
    return { applicant: (await db.query('select * from v_waitlist where applicant_id=$1', [a.id]))[0] || a,
      offers: await db.query('select p.code as property,o.offered_on,o.response,o.responded_on,o.reason from offers o join properties p on p.id=o.property_id where o.applicant_id=$1 order by o.offered_on desc', [a.id]) };
  }

  if (cmd === 'ledger') {
    const t = await tenancyOf(db, sub);
    const weeks = Number(f.weeks || 12);
    return db.query(`select posted_on,kind,round(amount_cents/100.0,2) as amount,round(sum(amount_cents) over (order by posted_on,kind desc,created_at)/100.0,2) as balance,reference
      from ledger where tenancy_id=$1 order by posted_on,kind desc,created_at`, [t.id]).then((rows) => rows.filter((r) => r.posted_on >= new Date(Date.now() - weeks * 7 * 86400e3).toISOString().slice(0, 10)));
  }

  if (cmd === 'insights') {
    const picks = sub ? String(sub).split(',').map(Number) : insightQueries.map((_, i) => i + 1);
    const out = [];
    for (const n of picks) {
      if (!insightQueries[n - 1]) throw Error(`insights takes 1 to ${insightQueries.length}`);
      out.push({ number: n, question: insightQueries[n - 1][0], rows: await db.query(insightQueries[n - 1][1]) });
    }
    return out;
  }

  if (cmd === 'show') { entity(sub); return resolve(db, sub, rest.join(' ')); }

  if (cmd === 'add') {
    entity(sub);
    if (sub === 'settings') throw Error('Use update settings --field=value');
    const v = await fieldValues(db, sub, f);
    const keys = Object.keys(v);
    if (!keys.length) throw Error(`Give fields: ${entities[sub].join(', ')}`);
    return (await db.query(`insert into ${sub} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(v)))[0];
  }

  if (cmd === 'update') {
    entity(sub);
    const row = await resolve(db, sub, rest.join(' '));
    const v = await fieldValues(db, sub, f);
    const keys = Object.keys(v);
    if (!keys.length) throw Error(`Give fields to change: ${entities[sub].join(', ')}`);
    return (await db.query(`update ${sub} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} where id=$${keys.length + 1} returning *`, [...Object.values(v), row.id]))[0];
  }

  if (cmd === 'assess') {
    const t = await tenancyOf(db, sub);
    const a = await assessment(db, t);
    const { _raw: ra, ...shown } = a;
    if (!f.apply) return shown;
    const effective = need(toDate(f.effective, '--effective'), 'Specify --effective=YYYY-MM-DD for the new rent');
    const notice = toDate(f.notice, '--notice');
    const s = await settingsOf(db);
    const required = ra.jurisdiction === 'QLD' ? s.qld_rent_notice_days : s.rent_notice_days;
    const warnings = [];
    if (ra.policy_rent_cents > ra.rent_cents && (!notice || (Date.parse(effective) - Date.parse(notice)) / 86400e3 < required))
      warnings.push(`This is an increase. ${ra.jurisdiction} needs at least ${required} days written notice; record --notice=date when it is given.`);
    await db.exec('BEGIN');
    try {
      await db.query('insert into rent_changes (tenancy_id,effective_on,old_rent_cents,rent_cents,assessed_cents,market_cents,notice_on,reason) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [t.id, effective, ra.rent_cents, ra.policy_rent_cents, ra.assessed_cents, ra.market_rent_cents, notice, f.reason || 'income review']);
      await db.query('update tenancies set rent_cents=$1,income_checked_on=$2 where id=$3', [ra.policy_rent_cents, toDate(f.on, '--on') || today(), t.id]);
      await db.exec('COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    return { tenancy: t.number, old_rent: money(ra.rent_cents), new_rent: money(ra.policy_rent_cents), effective_on: effective, notice_on: notice, warnings };
  }

  if (cmd === 'income') {
    const m = await resolve(db, 'members', sub);
    const weekly = need(cents(f.weekly, '--weekly'), 'Specify --weekly=dollars');
    return (await db.query('update members set income_weekly_cents=$1,income_source=coalesce($2,income_source) where id=$3 returning name,income_weekly_cents,income_source', [weekly, f.source || null, m.id]))[0];
  }

  if (cmd === 'rent-run') {
    const on = toDate(f.on, '--on') || today();
    const rows = await db.query(`select t.id,t.number,t.rent_cents,p.code from tenancies t join properties p on p.id=t.property_id where t.ended_on is null and t.started_on<=$1
      and not exists (select 1 from ledger l where l.tenancy_id=t.id and l.kind='rent' and l.posted_on>$1::date-7) order by p.code`, [on]);
    if (!f['dry-run']) for (const r of rows) await db.query(`insert into ledger (tenancy_id,posted_on,kind,amount_cents,reference) values ($1,$2,'rent',$3,'Weekly rent') on conflict do nothing`, [r.id, on, r.rent_cents]);
    return { posted_on: on, charged: rows.length, total: money(rows.reduce((a, r) => a + r.rent_cents, 0)), dry_run: Boolean(f['dry-run']), tenancies: rows.map((r) => `${r.code} ${money(r.rent_cents)}`) };
  }

  if (cmd === 'pay' || cmd === 'charge') {
    const t = await tenancyOf(db, sub);
    const amount = need(cents(f.amount, '--amount'), 'Specify --amount=dollars');
    const kind = cmd === 'pay' ? 'payment' : f.kind || 'adjustment';
    if (!['payment', 'water', 'repair charge', 'adjustment'].includes(kind)) throw Error('--kind must be water, repair charge or adjustment');
    await db.query('insert into ledger (tenancy_id,posted_on,kind,amount_cents,reference,note) values ($1,$2,$3,$4,$5,$6)',
      [t.id, toDate(f.on, '--on') || today(), kind, cmd === 'pay' ? -Math.abs(amount) : amount, f.ref || null, f.note || null]);
    return (await db.query('select tenancy,lead_tenant,round(balance_cents/100.0,2) as balance,days_in_arrears from v_balances where tenancy_id=$1', [t.id]))[0];
  }

  if (cmd === 'notice') {
    const t = await tenancyOf(db, sub);
    return (await db.query('update tenancies set arrears_notice_on=$1 where id=$2 returning number,arrears_notice_on', [toDate(f.on, '--on') || today(), t.id]))[0];
  }

  if (cmd === 'request') {
    const p = await resolve(db, 'properties', sub);
    const priority = f.priority || 'routine';
    if (!['urgent', 'priority', 'routine', 'planned'].includes(priority)) throw Error('--priority must be urgent, priority, routine or planned');
    const n = (await db.query('select count(*)::int as n from repairs'))[0].n + 2001;
    const t = (await db.query('select id from tenancies where property_id=$1 and ended_on is null', [p.id]))[0];
    const row = (await db.query(`insert into repairs (number,property_id,tenancy_id,reported_on,priority,category,description,contractor) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [f.number || `RQ-${n}`, p.id, t?.id || null, toDate(f.on, '--on') || today(), priority, f.category || 'general', need(rest.join(' '), 'Describe the repair'), f.contractor || null]))[0];
    return (await db.query('select number,property,priority,category,description,target_on,state from v_repairs where repair_id=$1', [row.id]))[0];
  }

  if (cmd === 'done') {
    const r = await resolve(db, 'repairs', sub);
    if (r.done_on) throw Error(`${r.number} was done on ${r.done_on}`);
    return (await db.query('update repairs set done_on=$1,cost_cents=coalesce($2,cost_cents),tenant_damage=$3 where id=$4 returning number,done_on,cost_cents,tenant_damage',
      [toDate(f.on, '--on') || today(), cents(f.cost, '--cost'), Boolean(f['tenant-damage']), r.id]))[0];
  }

  if (cmd === 'inspect') {
    const p = await resolve(db, 'properties', sub);
    const kind = need(f.kind, 'Specify --kind=routine|smoke alarm|gas|electrical|healthy homes|entry|exit');
    return (await db.query('insert into inspections (property_id,kind,done_on,done_by,result,note) values ($1,$2,$3,$4,$5,$6) returning kind,done_on,result',
      [p.id, kind, toDate(f.on, '--on') || today(), f.by || null, f.result || 'pass', f.note || null]))[0];
  }

  if (cmd === 'apply') {
    const n = (await db.query('select count(*)::int as n from applicants'))[0].n + 3001;
    return (await db.query(`insert into applicants (ref,name,phone,email,people,bedrooms_needed,needs_accessible,areas,band,register_ref,listed_on,last_contact_on) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning *`,
      [f.ref || `AP-${n}`, need(sub, 'Specify the applicant name'), f.phone || null, f.email || null, num(f.people, '--people') || 1, need(num(f.bedrooms, '--bedrooms'), 'Specify --bedrooms=n'),
        Boolean(f.accessible), f.areas || null, f.band || 'general', f.register || null, toDate(f.on, '--on') || today()]))[0];
  }

  if (cmd === 'contact') {
    const a = await resolve(db, 'applicants', sub);
    return (await db.query(`update applicants set last_contact_on=$1,note=coalesce($2,note) where id=$3 returning ref,name,last_contact_on`, [toDate(f.on, '--on') || today(), f.note || null, a.id]))[0];
  }

  if (cmd === 'match') {
    const p = await resolve(db, 'properties', sub);
    return db.query(`select w.ref,w.name,w.band,w.people,w.bedrooms_needed,w.needs_accessible,w.areas,w.days_waiting,w.days_since_contact
      from v_waitlist w where w.status='waiting' and w.bedrooms_needed<=$1 and w.bedrooms_needed>=$1-1 and (not w.needs_accessible or $2)
       and (w.areas is null or position(lower($3) in lower(w.areas))>0 or position(lower($4) in lower(w.areas))>0)
       and not exists (select 1 from offers o where o.applicant_id=w.applicant_id and o.property_id=$5)
      order by case w.band when 'priority' then 1 when 'transfer' then 2 else 3 end,w.days_waiting desc`, [p.bedrooms, p.accessible, p.suburb, p.region || p.suburb, p.id]);
  }

  if (cmd === 'offer') {
    const p = await resolve(db, 'properties', sub);
    const a = await resolve(db, 'applicants', need(f.to, 'Specify --to=<applicant>'));
    if ((await db.query('select 1 from tenancies where property_id=$1 and ended_on is null', [p.id])).length) throw Error(`${p.code} has a current tenancy`);
    if ((await db.query(`select 1 from offers where property_id=$1 and response='pending'`, [p.id])).length) throw Error(`${p.code} already has an offer waiting for an answer`);
    const on = toDate(f.on, '--on') || today();
    await db.query(`update applicants set status='offered',last_contact_on=$1 where id=$2`, [on, a.id]);
    return (await db.query('insert into offers (applicant_id,property_id,offered_on) values ($1,$2,$3) returning offered_on,response', [a.id, p.id, on]))[0];
  }

  if (cmd === 'reply') {
    const a = await resolve(db, 'applicants', sub);
    const o = (await db.query(`select * from offers where applicant_id=$1 and response='pending' order by offered_on desc limit 1`, [a.id]))[0];
    if (!o) throw Error(`${a.name} has no offer waiting for an answer`);
    const response = f.accepted ? 'accepted' : f.declined ? 'declined' : f['no-response'] ? 'no response' : null;
    need(response, 'Say --accepted, --declined or --no-response');
    const on = toDate(f.on, '--on') || today();
    await db.query('update offers set response=$1,responded_on=$2,reason=$3 where id=$4', [response, on, f.reason || null, o.id]);
    if (response !== 'accepted') await db.query(`update applicants set status='waiting',last_contact_on=$1 where id=$2`, [on, a.id]);
    return { applicant: a.name, response, next: response === 'accepted' ? `house "${a.ref}" --property=<code> --on=YYYY-MM-DD` : 'match <property> for the next applicant' };
  }

  if (cmd === 'house') {
    const a = await resolve(db, 'applicants', sub);
    const p = await resolve(db, 'properties', need(f.property, 'Specify --property=<code>'));
    const on = need(toDate(f.on, '--on'), 'Specify --on=YYYY-MM-DD, the tenancy start');
    await db.exec('BEGIN');
    try {
      const n = (await db.query('select count(*)::int as n from households'))[0].n + 1001;
      const h = (await db.query('insert into households (ref,name,phone,email) values ($1,$2,$3,$4) returning *', [f.ref || `HH-${n}`, a.name, a.phone, a.email]))[0];
      await db.query(`insert into members (household_id,name,relationship) values ($1,$2,'tenant')`, [h.id, a.name]);
      const t = (await db.query('insert into tenancies (number,household_id,property_id,started_on,rent_cents,income_checked_on) values ($1,$2,$3,$4,$5,$4) returning *',
        [f.number || `T-${n}`, h.id, p.id, on, cents(f.rent, '--rent') ?? p.market_rent_cents]))[0];
      await db.query(`update applicants set status='housed',last_contact_on=$1 where id=$2`, [on, a.id]);
      await db.query(`update offers set response='accepted',responded_on=coalesce(responded_on,$1) where applicant_id=$2 and property_id=$3 and response='pending'`, [on, a.id, p.id]);
      await db.exec('COMMIT');
      return { household: h.ref, tenancy: t.number, property: p.code, started_on: on, rent: money(t.rent_cents),
        next: `Add the household's members and income (add members --household=${h.ref} ...), then assess ${t.number} --apply --effective=${on}` };
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
  }

  if (cmd === 'end') {
    const t = await tenancyOf(db, sub);
    if (t.ended_on) throw Error(`${t.number} ended on ${t.ended_on}`);
    const reason = need(f.reason, 'Specify --reason="moved on" (or transfer, abandoned, terminated for arrears, terminated other, deceased, bought a home)');
    return (await db.query('update tenancies set ended_on=$1,end_reason=$2 where id=$3 returning number,ended_on,end_reason', [need(toDate(f.on, '--on'), 'Specify --on=YYYY-MM-DD'), reason, t.id]))[0];
  }

  if (cmd === 'complaint') {
    let h = null, a = null;
    try { h = await resolve(db, 'households', sub); } catch { a = await resolve(db, 'applicants', sub); }
    const n = (await db.query('select count(*)::int as n from complaints'))[0].n + 401;
    return (await db.query('insert into complaints (number,household_id,applicant_id,kind,category,received_on,summary) values ($1,$2,$3,$4,$5,$6,$7) returning number,kind,received_on,summary',
      [f.number || `CP-${String(n).padStart(4, '0')}`, h?.id || null, a?.id || null, f.kind || 'complaint', f.category || 'general', toDate(f.on, '--on') || today(), need(rest.join(' '), 'Summarise the complaint')]))[0];
  }

  if (cmd === 'resolve') {
    const c = await resolve(db, 'complaints', sub);
    return (await db.query('update complaints set responded_on=$1,outcome=$2 where id=$3 returning number,responded_on,outcome', [toDate(f.on, '--on') || today(), need(f.outcome, 'Specify --outcome="..."'), c.id]))[0];
  }

  if (cmd === 'log') {
    const h = await resolve(db, 'households', sub);
    const t = (await db.query('select id,property_id from tenancies where household_id=$1 order by started_on desc limit 1', [h.id]))[0];
    return (await db.query('insert into notes (household_id,tenancy_id,property_id,title,body) values ($1,$2,$3,$4,$5) returning title,body,created_at',
      [h.id, t?.id || null, t?.property_id || null, f.title || 'Note', need(rest.join(' '), 'Supply the note text')]))[0];
  }

  if (cmd === 'import') return importer(db, sub, f);

  if (cmd === 'export') {
    const snapshot = { format: 'community-housing-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      for (const kind of ['settings', 'rent_policies', 'programs', 'properties', 'households', 'members', 'tenancies', 'rent_changes', 'ledger', 'repairs', 'inspections', 'applicants', 'offers', 'complaints', 'notes'])
        snapshot.records[kind] = await db.query(`select * from ${kind} order by 1`);
      await db.exec('COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    const out = path.resolve(need(f.out, 'Specify --out=backup.json'));
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { file: out, counts: Object.fromEntries(Object.entries(snapshot.records).map(([k, v]) => [k, v.length])) };
  }

  if (cmd === 'weekly-review') {
    const data = { attention: await execute(db, ['attention']), kpis: await execute(db, ['kpis']), compliance: await execute(db, ['compliance']) };
    const s = await settingsOf(db);
    const rules = data.compliance.filter((r) => r.due_date <= today()).length;
    const arrears = data.attention.filter((r) => r.item === 'ARREARS').length;
    const lead = rules ? `${rules} record check(s) are past their date. Those come first.` : arrears ? `${arrears} household(s) are a week or more behind on rent.` : 'No rule dates passed and nobody is behind on rent.';
    return draft('weekly-review', `# ${s.business_name}: weekly housing review, ${today()}\n\n${lead}\n\n## The numbers\n\n${human(data.kpis)}\n\n## Needs someone this week\n\n${human(data.attention)}\n\n` +
      `## Record checks\n\n${human(data.compliance.map(({ source, ...r }) => r))}\n\nSources for each rule: docs/compliance.md. Draft only. Nothing has been sent.\n`, data);
  }

  if (cmd === 'draft-arrears') {
    const t = await tenancyOf(db, sub);
    const b = (await db.query('select * from v_balances where tenancy_id=$1', [t.id]))[0];
    if (!b || b.balance_cents <= 0) throw Error(`${t.number} is not behind on rent`);
    const s = await settingsOf(db);
    const h = (await db.query('select * from households where id=$1', [t.household_id]))[0];
    const past = b.days_in_arrears >= b.threshold_days;
    const text = `# Draft only: rent arrears letter\n\nTo: ${b.lead_tenant}\nProperty: ${b.property}\nSubject: Your rent account\n\nDear ${b.lead_tenant.split(' ')[0]},\n\n` +
      `Our records show your rent account is ${b.currency} ${money(b.balance_cents)} behind, about ${b.days_in_arrears} days of rent. Your last payment was ${b.last_payment_on || 'not recorded'}.\n\n` +
      `We would like to help you get back on track before this becomes a bigger problem. Please call us this week so we can agree a payment plan that works for you. ` +
      `If your income has changed, tell us: your rent may need to be reassessed.${h.support_provider ? ` We are happy to include ${h.support_worker || 'your support worker'} from ${h.support_provider} in that conversation.` : ''}\n\n` +
      `Kind regards,\n${s.business_name}\n\n---\nNothing has been sent.${past ? ` This tenancy is past the ${b.jurisdiction} threshold of ${b.threshold_days} days. A formal notice follows the form your tribunal requires and your sustaining tenancies policy; this letter is not that notice. Once a formal notice is served, record it: notice ${t.number} --on=YYYY-MM-DD` : ''}\n`;
    return draft('arrears-letter', text, b);
  }

  if (cmd === 'draft-rent-notice') {
    const t = await tenancyOf(db, sub);
    const a = await assessment(db, t);
    const s = await settingsOf(db);
    const ra = a._raw;
    const required = ra.jurisdiction === 'QLD' ? s.qld_rent_notice_days : s.rent_notice_days;
    const up = ra.policy_rent_cents > ra.rent_cents;
    const from = new Date(Date.now() + (up ? required : 14) * 86400e3).toISOString().slice(0, 10);
    const lines = a.working.map((w) => `| ${w.line} | ${w.amount} |`).join('\n');
    const text = `# Draft only: notice of rent change\n\nTo: ${a.lead_tenant}\nProperty: ${a.property}\n\nDear ${a.lead_tenant.split(' ')[0]},\n\n` +
      `We have reviewed your household income under our rent policy (${a.policy}). Your weekly rent will change from ${a.currency} ${a.charged} to ${a.currency} ${a.policy_rent}, starting ${from}.\n\n` +
      `How it was worked out:\n\n| Item | Weekly ${a.currency} |\n|---|---:|\n${lines}\n\n` +
      `If anything here is wrong, or your income changes, tell us and we will reassess. You can ask for a review of this decision under our appeals policy.\n\nKind regards,\n${s.business_name}\n\n---\n` +
      `Nothing has been sent. ${up ? `This is an increase: give at least ${required} days written notice (docs/compliance.md, RENT-NOTICE).` : 'This is a decrease or no change.'} ` +
      `Once given, record it: assess ${t.number} --apply --effective=${from} --notice=${today()}\n`;
    return draft('rent-notice', text, (({ _raw, ...x }) => x)(a));
  }

  if (cmd === 'draft-offer') {
    const a = await resolve(db, 'applicants', sub);
    const o = (await db.query(`select o.*,p.code,p.address,p.suburb,p.bedrooms,p.dwelling,p.currency,p.market_rent_cents from offers o join properties p on p.id=o.property_id where o.applicant_id=$1 order by o.offered_on desc limit 1`, [a.id]))[0];
    if (!o) throw Error(`${a.name} has no offer on record. Make one first: offer <property> --to="${a.ref}"`);
    const s = await settingsOf(db);
    const reply = new Date(Date.parse(o.offered_on) + s.offer_days * 86400e3).toISOString().slice(0, 10);
    const text = `# Draft only: offer of housing\n\nTo: ${a.name}\nReference: ${a.ref}${a.register_ref ? ` (register ${a.register_ref})` : ''}\n\nDear ${a.name.split(' ')[0]},\n\n` +
      `We are pleased to offer you a ${o.bedrooms} bedroom ${o.dwelling} at ${o.address}, ${o.suburb}.\n\n` +
      `Your rent will be set from your household income under our rent policy, and will never be more than the market rent of ${o.currency} ${money(o.market_rent_cents)} a week. ` +
      `We will need proof of income for everyone in the household before the tenancy starts.\n\nPlease let us know by ${reply} whether you would like to view the home and accept this offer.\n\n` +
      `Kind regards,\n${s.business_name}\n\n---\nNothing has been sent. Record the answer: reply "${a.ref}" --accepted|--declined|--no-response\n`;
    return draft('offer-letter', text, o);
  }

  if (cmd === 'draft-review-request') {
    const t = await tenancyOf(db, sub);
    const a = await assessment(db, t);
    const s = await settingsOf(db);
    const members = await db.query('select name,income_source from v_member_rates where household_id=$1 and band<>$2', [a._raw.household_id, 'under 18, not assessed']);
    const text = `# Draft only: income review request\n\nTo: ${a.lead_tenant}\nProperty: ${a.property}\nSubject: Your yearly rent review\n\nDear ${a.lead_tenant.split(' ')[0]},\n\n` +
      `It is time for your household's rent review (last done ${a.income_checked_on || 'not recorded'}). Please send us, within 21 days, current proof of income for:\n\n` +
      `${members.map((m) => `- ${m.name}${m.income_source ? ` (${m.income_source})` : ''}`).join('\n')}\n- Your Centrelink income statement showing Rent Assistance and Family Tax Benefit, if you receive them\n\n` +
      `If anyone has moved in or out, tell us too. Your rent stays affordable because it is based on what your household earns.\n\nKind regards,\n${s.business_name}\n\nNothing has been sent. When the details arrive: income <member> --weekly=..., then assess ${t.number}\n`;
    return draft('review-request', text, { tenancy: t.number, members });
  }

  throw Error(`Unknown command ${cmd}. Run help.`);
}

function draft(prefix, text, data) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${today()}-${Math.random().toString(16).slice(2, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  return { file, data, sent: false };
}

const hidden = (k) => ['id', 'created_at', 'updated_at'].includes(k) || k.endsWith('_id');
export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (typeof value[0] !== 'object' || value[0] === null) return value.map((v) => `  ${v}`).join('\n');
    if (value[0]?.question) return value.map((x) => `${x.number}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => !hidden(k));
    return table(value, keys.map((key) => ({ key, label: key.replaceAll('_', ' '), width: 70, format: (v) => (v instanceof Date ? v.toISOString().slice(0, 16) : v == null ? '' : String(v)) })));
  }
  if (value && typeof value === 'object') {
    const flat = (v) => v === null || typeof v !== 'object' || v instanceof Date;
    const scalars = Object.entries(value).filter(([k, v]) => flat(v) && !hidden(k)).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v instanceof Date ? v.toISOString().slice(0, 16) : v ?? ''}`);
    const nested = Object.entries(value).filter(([, v]) => !flat(v)).map(([k, v]) => `${k.replaceAll('_', ' ')}:\n${human(v)}`);
    return [scalars.join('\n'), ...nested].filter(Boolean).join('\n\n');
  }
  return String(value ?? '');
}

// Civica Cx Housing tenancy and property reports, saved from Excel as CSV.
// Cx reports are configured per provider, so there are no fixed column names; the import reads the common labels below.
// docs/replace-civica-cx-housing.md says how to add your own.
export const COLUMNS = {
  property: ['Property Ref', 'Property Reference', 'Property Code', 'Property ID', 'Place Ref', 'Asset Ref', 'Property'],
  address: ['Address', 'Property Address', 'Address Line 1', 'Street Address'],
  suburb: ['Suburb', 'Town', 'Locality', 'City'],
  state: ['State', 'Jurisdiction', 'Region State'],
  region: ['Region', 'Area', 'Patch', 'Office'],
  bedrooms: ['Bedrooms', 'Beds', 'No of Bedrooms', 'Bedroom Count'],
  dwelling: ['Property Type', 'Dwelling Type', 'Type', 'Archetype'],
  program: ['Program', 'Programme', 'Funding Program', 'Tenure Type', 'Scheme'],
  market: ['Market Rent', 'Weekly Market Rent', 'Market Rent (Weekly)'],
  tenancy: ['Tenancy Ref', 'Tenancy Reference', 'Tenancy Number', 'Tenancy ID', 'Agreement Ref', 'Account Number', 'Rent Account'],
  household: ['Household Ref', 'Household ID', 'Person Ref', 'Tenant Ref', 'Client Ref'],
  name: ['Lead Tenant', 'Tenant Name', 'Tenant', 'Main Tenant', 'Name', 'Primary Tenant'],
  phone: ['Phone', 'Mobile', 'Contact Number', 'Telephone'],
  email: ['Email', 'Email Address'],
  start: ['Tenancy Start', 'Tenancy Start Date', 'Start Date', 'Commencement Date'],
  end: ['Tenancy End', 'Tenancy End Date', 'End Date'],
  rent: ['Weekly Rent', 'Rent', 'Current Rent', 'Rent Charged', 'Net Rent'],
  reviewed: ['Last Income Review', 'Income Review Date', 'Last Review Date', 'Rent Review Date'],
  balance: ['Balance', 'Arrears', 'Current Balance', 'Account Balance', 'Rent Balance'],
};
const DWELLINGS = { house: 'house', townhouse: 'townhouse', unit: 'unit', apartment: 'apartment', flat: 'unit', villa: 'unit', studio: 'studio', 'bedsit': 'studio', 'boarding room': 'boarding room', room: 'boarding room' };
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'NZ'];

async function importer(db, vendor, f) {
  if (!['cx', 'balances'].includes(vendor)) throw Error('Supported imports: cx (the tenancy and property list) and balances (opening rent balances)');
  const file = need(f.file, 'Specify --file=report.csv');
  if (!String(file).toLowerCase().endsWith('.csv')) throw Error('Save the report from Excel as CSV first. Read docs/replace-civica-cx-housing.md.');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw Error('CSV has no data rows');
  const get = (row, col) => pick(row, ...COLUMNS[col]).trim();
  const counts = { rows: rows.length, properties_added: 0, households_added: 0, tenancies_added: 0, updated: 0 };
  const warnings = [];
  await db.exec('BEGIN');
  try {
    if (vendor === 'cx') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const code = need(get(row, 'property'), `${where}: a property reference column is required (Property Ref)`);
        let p = (await db.query('select * from properties where lower(code)=lower($1) or lower(external_id)=lower($1)', [code]))[0];
        if (!p) {
          const progName = need(get(row, 'program') || f.program, `${where}: no Program column; pass --program=<code>`);
          const g = (await db.query('select * from programs where lower(code)=lower($1) or lower(name)=lower($1)', [progName]))[0];
          if (!g) throw Error(`${where}: program "${progName}" is not set up. Add it first: add programs --code=XX --name="${progName}" --rent-policy=<policy code>`);
          const st = (get(row, 'state') || (await db.query('select jurisdiction from rent_policies where id=$1', [g.rent_policy_id]))[0].jurisdiction).toUpperCase();
          if (!STATES.includes(st)) throw Error(`${where}: state "${st}" is not one of ${STATES.join(', ')}`);
          p = (await db.query(`insert into properties (code,address,suburb,region,jurisdiction,currency,dwelling,bedrooms,program_id,market_rent_cents,external_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$1) returning *`,
            [code, need(get(row, 'address'), `${where}: Address required for a new property`), get(row, 'suburb') || '(unknown)', get(row, 'region') || null, st, st === 'NZ' ? 'NZD' : 'AUD',
              DWELLINGS[get(row, 'dwelling').toLowerCase()] || 'unit', num(get(row, 'bedrooms'), `${where} Bedrooms`) ?? 1, g.id, cents(get(row, 'market'), `${where} Market Rent`) ?? 0]))[0];
          counts.properties_added++;
          if (!p.market_rent_cents) warnings.push(`${code}: no market rent; set it with update properties ${code} --market-rent=dollars`);
        }
        const name = get(row, 'name');
        if (!name) continue; // a property with no tenant: void
        const hRef = get(row, 'household') || get(row, 'tenancy') || code;
        let h = (await db.query('select * from households where lower(ref)=lower($1) or lower(external_id)=lower($1)', [hRef]))[0];
        if (!h) {
          h = (await db.query('insert into households (ref,name,phone,email,external_id) values ($1,$2,$3,$4,$1) returning *', [hRef, name, get(row, 'phone') || null, get(row, 'email') || null]))[0];
          await db.query(`insert into members (household_id,name,relationship) values ($1,$2,'tenant')`, [h.id, name]);
          counts.households_added++;
        } else { await db.query('update households set phone=coalesce($1,phone),email=coalesce($2,email) where id=$3', [get(row, 'phone') || null, get(row, 'email') || null, h.id]); counts.updated++; }
        const tRef = get(row, 'tenancy') || `${code}-${hRef}`;
        const existing = (await db.query('select * from tenancies where lower(number)=lower($1) or lower(external_id)=lower($1)', [tRef]))[0];
        const vals = [cents(get(row, 'rent'), `${where} Weekly Rent`), toDate(get(row, 'reviewed'), `${where} Last Income Review`), toDate(get(row, 'end'), `${where} Tenancy End`)];
        if (existing) await db.query('update tenancies set rent_cents=coalesce($1,rent_cents),income_checked_on=coalesce($2,income_checked_on),ended_on=coalesce($3,ended_on) where id=$4', [...vals, existing.id]);
        else {
          await db.query(`insert into tenancies (number,household_id,property_id,started_on,rent_cents,income_checked_on,ended_on,end_reason,external_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$1)`,
            [tRef, h.id, p.id, need(toDate(get(row, 'start'), `${where} Tenancy Start`), `${where}: Tenancy Start required`), vals[0] ?? 0, vals[1], vals[2], vals[2] ? 'moved on' : null]);
          counts.tenancies_added++;
        }
      }
      const noIncome = (await db.query('select count(*)::int as n from v_rent_assessment where household_income_cents=0'))[0].n;
      if (noIncome) warnings.push(`${noIncome} current tenancies have no household income recorded yet, so the rent check cannot run for them. Add members and income, or ask Claude Code to map your household report.`);
    } else {
      const on = toDate(f.on, '--on') || today();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const key = need(get(row, 'tenancy') || get(row, 'property'), `${where}: Tenancy Ref or Property Ref required`);
        const t = (await db.query(`select t.* from tenancies t join properties p on p.id=t.property_id where lower(t.number)=lower($1) or lower(t.external_id)=lower($1) or (lower(p.code)=lower($1) and t.ended_on is null)`, [key]))[0];
        if (!t) throw Error(`${where}: no tenancy "${key}". Import the tenancy list first.`);
        const bal = need(cents(get(row, 'balance'), `${where} Balance`), `${where}: Balance required`);
        if ((await db.query(`select 1 from ledger where tenancy_id=$1 and kind='opening balance'`, [t.id])).length) { warnings.push(`${key}: already has an opening balance, skipped`); continue; }
        await db.query(`insert into ledger (tenancy_id,posted_on,kind,amount_cents,reference) values ($1,$2,'opening balance',$3,'Imported from Cx Housing')`, [t.id, on, bal]);
        counts.updated++;
      }
    }
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  return { import: vendor, ...counts, dry_run: Boolean(f['dry-run']), warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  const args = process.argv.slice(2), json = args.includes('--json');
  try { db = await getDb(); const out = await execute(db, args); console.log(json ? JSON.stringify(out, null, 2) : human(out)); }
  catch (e) { if (json) console.log(JSON.stringify({ error: e.message, ...(e.matches ? { matches: e.matches } : {}) })); else console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
