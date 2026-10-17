// npm test: a temporary embedded database (or an isolated schema on TEST_DATABASE_URL),
// migrate, seed twice, then every command, rent rule, threshold, import, draft, document and view.
// Never touches your data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, human, insightQueries } from './housing.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'community-housing-smoke-'));
const postgresUrl = process.env.TEST_DATABASE_URL || '';
let control, schema;
if (postgresUrl) {
  const { default: pg } = await import('pg');
  control = new pg.Client({ connectionString: postgresUrl }); await control.connect();
  schema = 'housing_test_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
  await control.query(`create schema ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema},public`;
}
process.env.DATABASE_URL = postgresUrl; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
const db = await getDb();
let checks = 0;
const run = (...args) => execute(db, args);
const ok = (condition, message) => { assert.ok(condition, message); console.log(`ok ${++checks}: ${message}`); };
const fail = async (args, pattern) => { await assert.rejects(() => run(...args), pattern); ok(true, `Rejects: ${args.slice(0, 3).join(' ')} (${pattern.source})`); };
const count = async (t, where = 'true') => Number((await db.query(`select count(*) as n from ${t} where ${where}`))[0].n);
const findings = async (rule) => (await run('compliance')).filter((x) => x.rule === rule);
const attention = async (item) => (await run('attention')).filter((x) => x.item === item);
const one = async (sql, params = []) => (await db.query(sql, params))[0];
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const rentOf = async (number) => Number((await one('select rent_cents from tenancies where number=$1', [number])).rent_cents);

try {
  ok((await migrate(db)).ran.length === 1, 'Migration applies');
  ok((await migrate(db)).ran.length === 0, 'Migration is idempotent');
  await seed(db);
  const before = { ledger: await count('ledger'), tenancies: await count('tenancies'), members: await count('members'), inspections: await count('inspections') };
  await seed(db);
  ok(before.ledger > 500 && (await count('ledger')) === before.ledger && (await count('tenancies')) === before.tenancies && (await count('members')) === before.members
    && (await count('inspections')) === before.inspections, 'Seed is idempotent');

  // Every read
  for (const c of ['help', 'policies', 'programs', 'properties', 'households', 'tenancies', 'rent', 'arrears', 'reviews', 'voids', 'repairs', 'checks', 'waitlist', 'offers', 'complaints',
    'compliance', 'attention', 'kpis', 'settings'])
    ok(Boolean(await run(c)), `Read ${c}`);
  ok((await run('tenancies')).length === 20, 'Twenty current tenancies');
  ok((await run('voids')).length === 4, 'Four empty homes');
  ok((await run('repairs', '--state=overdue')).every((r) => r.state === 'overdue'), 'State filter on reads');
  const pr = await run('property', 'PR-103');
  ok(pr.tenancies.length === 1 && pr.repairs.length === 1 && pr.compliance.length >= 2, 'Property detail: tenancy, repairs, findings');
  const hh = await run('household', 'brennan');
  ok(hh.members.length === 4 && hh.tenancies[0].property === 'PR-105', 'Household detail finds members and home');
  ok((await run('tenancy', 'PR-102')).tenancy === 'T-1002', 'Tenancy by property code');
  ok((await run('tenancy', 'Daniel Okafor')).balance.days_in_arrears === 21, 'Tenancy by tenant name carries the balance');
  ok((await run('applicant', 'AP-3005')).offers.length === 1, 'Applicant detail shows offers');
  ok((await run('ledger', 'T-1002', '--weeks=4')).at(-1).balance > 0, 'Ledger runs a balance');

  // Name matching
  ok((await run('show', 'households', 'JOYCE TAN')).ref === 'HH-1006', 'Case-insensitive name match');
  ok((await run('show', 'households', 'okafor')).ref === 'HH-1002', 'Name fragment match');
  await fail(['show', 'properties', 'PR-10'], /Ambiguous properties/);
  await fail(['show', 'households', 'nobody-like-this'], /No households match/);

  // The rent formula: each band, FTB, CRA and the market cap
  const brennan = await one(`select * from v_rent_assessment where tenancy='T-1005'`);
  ok(brennan.income_part_cents === 15250 + 14375 + 4800, 'Income part: 25% of tenant and partner, 15% of the 19 year old, nothing for the child');
  ok(brennan.ftb_part_cents === 2700 && brennan.cra_part_cents === 13800, 'FTB at 15% and CRA at 100%');
  ok(brennan.policy_rent_cents === 50925 && brennan.rent_cents === 50925, 'Policy rent is the sum when under market');
  const bands = await db.query(`select m.name,m.band from v_member_rates m join households h on h.id=m.household_id where h.ref='HH-1005' order by m.name`);
  ok(bands.find((b) => b.name === 'Ella Brennan').band === 'aged 18 to 20' && bands.find((b) => b.name === 'Sam Brennan').band === 'under 18, not assessed', 'Members fall into the right bands');
  const sione = (await db.query(`select id from members where name='Sione Fifita'`))[0];
  await run('income', sione.id, '--weekly=3000');
  const capped = await one(`select * from v_rent_assessment where tenancy='T-1007'`);
  ok(capped.policy_rent_cents === capped.market_rent_cents && capped.assessed_cents > capped.market_rent_cents, 'Market rent caps the policy rent');
  await run('income', sione.id, '--weekly=960');
  const nz = (await run('assess', 'T-1022')).working;
  ok(nz.length === 2 && nz[0].line.includes('MSD'), 'NZ income-related rent shows as assessed outside the provider');

  // Attention: one of each kind in the seed
  for (const item of ['ARREARS', 'VOID LONG', 'REPAIR OVERDUE', 'OFFER NO ANSWER', 'COMPLAINT DUE', 'WAITLIST STALE', 'RULE RENT-ABOVE-POLICY', 'RULE RENT-ABOVE-MARKET', 'RULE INCOME-REVIEW',
    'RULE RENT-NOTICE', 'RULE ARREARS-THRESHOLD', 'RULE SMOKE-ALARM', 'RULE VIC-GAS-CHECK', 'RULE VIC-ELECTRICAL-CHECK', 'RULE NZ-HEALTHY-HOMES', 'RULE COMPLAINT-RESPONSE'])
    ok((await attention(item)).length > 0, `Attention finds ${item}`);
  ok((await run('attention'))[0].item.startsWith('RULE'), 'Rule findings lead the attention list');

  // Every rule has seeded evidence, a source and a doc entry
  const rules = ['RENT-ABOVE-POLICY', 'RENT-ABOVE-MARKET', 'INCOME-REVIEW', 'RENT-NOTICE', 'ARREARS-THRESHOLD', 'SMOKE-ALARM', 'VIC-GAS-CHECK', 'VIC-ELECTRICAL-CHECK', 'NZ-HEALTHY-HOMES', 'COMPLAINT-RESPONSE'];
  const all = await run('compliance');
  ok(rules.every((r) => all.some((x) => x.rule === r)), 'Every compliance rule has seeded evidence');
  ok(all.every((x) => x.source), 'Every finding carries its source');
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'compliance.md'), 'utf8');
  ok(rules.every((r) => doc.includes(`## ${r}`)), 'Every rule is documented in docs/compliance.md');

  // Arrears thresholds by jurisdiction
  const arrears = (await findings('ARREARS-THRESHOLD')).map((x) => x.record).sort();
  ok(JSON.stringify(arrears) === JSON.stringify(['GL-205', 'LG-303', 'PR-102']), 'NSW 21 days, VIC 21 days and QLD 14 days are past threshold');
  ok(!arrears.includes('GL-202'), 'VIC 7 days is under the 14 day threshold');
  ok(!arrears.includes('CH-401'), 'NZ 28 days with a notice served in that time is not flagged again');
  await run('notice', 'T-1002');
  ok(!(await findings('ARREARS-THRESHOLD')).some((x) => x.record === 'PR-102'), 'Recording a notice clears the arrears finding');
  await run('pay', 'T-1013', '--amount=626.25');
  ok((await run('tenancy', 'T-1013')).balance.days_in_arrears === 0 && !(await findings('ARREARS-THRESHOLD')).some((x) => x.record === 'GL-205'), 'A payment clears the arrears');
  await run('charge', 'T-1013', '--amount=45', '--kind=water');
  ok(Number((await run('tenancy', 'T-1013')).balance.owed) === 45, 'Charges add to the balance');
  await fail(['charge', 'T-1013', '--amount=5', '--kind=bond'], /--kind must be/);

  // Rent assessment and notices
  ok((await findings('RENT-ABOVE-POLICY')).some((x) => x.record === 'PR-104'), 'Ahmad is charged above policy');
  const fixed = await run('assess', 'PR-104', '--apply', `--effective=${day(0)}`);
  ok(fixed.new_rent === '208.75' && (await rentOf('T-1004')) === 20875 && !(await findings('RENT-ABOVE-POLICY')).length, 'Applying the assessment brings the rent to policy');
  ok((await one(`select count(*)::int as n from rent_changes rc join tenancies t on t.id=rc.tenancy_id where t.number='T-1004'`)).n === 2, 'The rent change is recorded');
  const margaret = (await db.query(`select id from members where name='Margaret Hollis'`))[0];
  await run('income', margaret.id, '--weekly=700', '--source=Age Pension and part-time work');
  const rise = await run('assess', 'T-1001', '--apply', `--effective=${day(30)}`, `--notice=${day(0)}`);
  ok(rise.warnings.length === 1 && rise.warnings[0].includes('60 days'), 'An increase with 30 days notice warns');
  ok((await findings('RENT-NOTICE')).some((x) => x.record === 'PR-101'), 'The short notice shows as a finding');
  await fail(['assess', 'T-1001', '--apply'], /--effective/);
  ok((await findings('INCOME-REVIEW')).length === 3, 'Three income reviews overdue or due');

  // The weekly rent run
  ok((await run('rent-run')).charged === 0, 'Rent run does not double-charge a week');
  const ahead = await run('rent-run', `--on=${day(7)}`, '--dry-run');
  ok(ahead.charged === 20 && ahead.dry_run, 'Dry run shows next week');
  ok((await run('rent-run', `--on=${day(7)}`)).charged === 20 && (await run('rent-run', `--on=${day(8)}`)).charged === 0, 'Rent run charges once a week');

  // Repairs and checks
  const req = await run('request', 'LG-304', 'Front', 'gate', 'off', 'its', 'hinges', '--priority=priority', '--contractor=Logan Handyman (demo)');
  ok(req.target_on === day(7) && req.state === 'open', 'Repair request gets its target date');
  await fail(['request', 'LG-304', 'Leak', '--priority=whenever'], /--priority must be/);
  ok((await run('done', req.number, '--cost=180')).cost_cents === 18000, 'Repair closed with cost');
  await fail(['done', req.number], /was done on/);
  await run('inspect', 'LG-302', '--kind=smoke alarm', '--by=Logan Fire Safety (demo)');
  ok(!(await findings('SMOKE-ALARM')).some((x) => x.record === 'LG-302'), 'A smoke alarm check clears the finding');
  await run('inspect', 'GL-203', '--kind=electrical');
  ok(!(await findings('VIC-ELECTRICAL-CHECK')).some((x) => x.record === 'GL-203'), 'An electrical check clears the VIC finding');
  await run('inspect', 'CH-402', '--kind=healthy homes', '--result=pass');
  ok(!(await findings('NZ-HEALTHY-HOMES')).length, 'A passed healthy homes assessment clears the NZ finding');

  // Waiting list to tenancy
  const ap = await run('apply', 'Dana Whitlock', '--bedrooms=0', '--areas=Linwood, Christchurch', '--band=priority', '--register=MSD-HR-130001');
  ok(ap.ref.startsWith('AP-') && ap.status === 'waiting', 'New applicant on the waiting list');
  const fits = await run('match', 'CH-405');
  ok(fits[0].band === 'priority' && fits.some((x) => x.name === 'Dana Whitlock'), 'Match ranks priority applicants who fit');
  await fail(['offer', 'CH-401', `--to=${ap.ref}`], /current tenancy/);
  await run('offer', 'CH-405', '--to=Hemi Walker');
  await fail(['offer', 'CH-405', `--to=${ap.ref}`], /already has an offer/);
  ok((await run('reply', 'Hemi Walker', '--declined', '--reason=Wants a bedroom')).response === 'declined', 'Declined offer recorded');
  await run('offer', 'CH-405', `--to=${ap.ref}`);
  await run('reply', ap.ref, '--accepted');
  const housed = await run('house', ap.ref, '--property=CH-405', `--on=${day(0)}`, '--rent=120');
  ok(housed.tenancy && housed.rent === '120.00', 'Applicant housed: household and tenancy created');
  ok(!(await run('voids')).some((v) => v.property === 'CH-405') && (await one(`select status from applicants where ref=$1`, [ap.ref])).status === 'housed', 'Home leaves the void list, applicant is housed');
  await run('end', 'T-1018', `--on=${day(0)}`, '--reason=moved on');
  ok((await run('voids')).some((v) => v.property === 'LG-304'), 'An ended tenancy shows as a void');
  await fail(['end', 'T-1018', `--on=${day(0)}`, '--reason=moved on'], /ended on/);
  ok((await run('contact', 'Nguyen')).last_contact_on === day(0) && !(await attention('WAITLIST STALE')).some((x) => x.record === 'AP-3003'), 'Contact clears a stale applicant');

  // Complaints
  await run('resolve', 'CP-0401', '--outcome=Hot water replaced, apology given');
  ok(!(await findings('COMPLAINT-RESPONSE')).length, 'Answering a complaint clears the finding');
  ok((await run('complaint', 'Tui Ngata', 'Neighbour', 'noise', 'at', 'night', '--category=neighbours')).number.startsWith('CP-'), 'Complaint logged');
  ok((await run('log', 'HH-1016', 'Called', 'about', 'noise')).title === 'Note', 'Note logged');

  // Generic writes
  const added = await run('add', 'properties', '--code=PR-120', '--address=5 Test St', '--suburb=Penrith', '--jurisdiction=NSW', '--program=NSW-SH', '--market-rent=500', `--available-since=${day(-3)}`);
  ok(added.market_rent_cents === 50000, 'Add with a program reference and dollars');
  ok((await run('update', 'properties', 'PR-120', '--bedrooms=2')).bedrooms === 2, 'Update a record');
  await fail(['update', 'properties', 'PR-120', '--colour=blue'], /no field colour/);
  ok((await run('update', 'settings', '--void-target-days=21')).void_target_days === 21, 'Settings are editable');

  // Import from Cx Housing
  const csv = path.join(REPO_ROOT, 'examples', 'cx-housing', 'tenancies.csv');
  const dry = await run('import', 'cx', `--file=${csv}`, '--dry-run');
  ok(dry.properties_added === 3 && dry.tenancies_added === 2 && (await count('properties', `code like 'CX-%'`)) === 0, 'Import dry run counts and rolls back');
  const imp = await run('import', 'cx', `--file=${csv}`);
  ok(imp.tenancies_added === 2 && (await rentOf('TEN-88001')) === 31250, 'Import brings properties, households and tenancies');
  ok((await run('voids')).some((v) => v.property === 'CX-5003'), 'A property with no tenant imports as a void');
  ok(imp.warnings.some((w) => w.includes('no household income')), 'Import warns where income is missing');
  ok((await run('import', 'cx', `--file=${csv}`)).tenancies_added === 0, 'Import is safe to run twice');
  const bal = await run('import', 'balances', `--file=${path.join(REPO_ROOT, 'examples', 'cx-housing', 'balances.csv')}`);
  ok(bal.updated === 2 && Number((await run('tenancy', 'TEN-88001')).balance.owed) === 625, 'Opening balances import');
  await fail(['import', 'cx', '--file=report.xlsx'], /Save the report from Excel as CSV/);
  await fail(['import', 'yardi', `--file=${csv}`], /Supported imports/);
  const bad = path.join(temp, 'bad.csv');
  fs.writeFileSync(bad, 'Property Ref,Address\nZZ-1,1 Nowhere Rd\n');
  await fail(['import', 'cx', `--file=${bad}`], /no Program column/);

  // Export
  const exp = await run('export', `--out=${path.join(temp, 'backup.json')}`);
  ok(exp.counts.tenancies > 20 && JSON.parse(fs.readFileSync(exp.file, 'utf8')).format === 'community-housing-for-claude-code/v1', 'Export writes a full backup');

  // Drafts: written to drafts/, never sent, in plain words
  const drafts = [await run('weekly-review'), await run('draft-arrears', 'Ray Simmons'), await run('draft-rent-notice', 'T-1006'), await run('draft-offer', 'AP-3005'), await run('draft-review-request', 'T-1003')];
  for (const d of drafts) {
    const text = fs.readFileSync(d.file, 'utf8');
    ok(d.sent === false && text.includes('Nothing has been sent') && !text.includes('\u2014'), `Draft ${path.basename(d.file).split('-2')[0]} is saved, unsent, no em dashes`);
  }
  ok(fs.readFileSync(drafts[1].file, 'utf8').includes('past the QLD threshold'), 'Arrears letter warns past the threshold');
  ok(fs.readFileSync(drafts[2].file, 'utf8').includes('60 days'), 'Rent notice states the notice period for an increase');
  await fail(['draft-arrears', 'TEN-88002'], /not behind/);

  // Insights: every question answers
  const ins = await run('insights');
  ok(ins.length === 10 && ins.length === insightQueries.length, 'Ten insight questions');
  for (const q of ins) ok(q.rows.length > 0, `Insight ${q.number} answers: ${q.question.slice(0, 60)}`);
  ok(human(ins).includes('1. Which households'), 'Insights render for people');

  // KPIs
  const k = await run('kpis');
  ok(k.length === 8 && k.every((x) => x.value !== undefined), 'Eight performance measures');

  // Views and documents render from this database
  const env = { ...process.env };
  for (const script of ['view.mjs', 'docs.mjs']) {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { cwd: REPO_ROOT, env, encoding: 'utf8' });
    ok(r.status === 0, `${script} runs (${(r.stderr || '').trim().slice(0, 80)})`);
  }
  for (const v of ['week', 'rent', 'voids', 'safety']) ok(fs.existsSync(path.join(temp, 'views', `${v}.html`)), `View ${v} rendered`);
  for (const d of ['rent-statement', 'rent-assessment', 'property-compliance', 'board-report']) ok(fs.readdirSync(path.join(temp, 'docs-out', d)).length > 0, `Document ${d} rendered`);
  ok(fs.readFileSync(path.join(temp, 'views', 'week.html'), 'utf8').includes('Tidewater Community Housing'), 'Views carry the brand');

  // The CLI as a process
  const cli = (...a) => spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'housing.mjs'), ...a], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  ok(cli('help').status === 0, 'CLI help exits 0');
  const amb = cli('show', 'properties', 'PR-10', '--json');
  ok(amb.status === 1 && JSON.parse(amb.stdout).matches.length > 1, 'Ambiguous name lists candidates and exits 1');
  ok(JSON.parse(cli('voids', '--json').stdout).length > 0, '--json prints machine output');

  // Every slash command points at a real CLI command; no author placeholders or em dashes left
  const help = (await run('help')).commands.map((c) => c.split(' ')[0]);
  const cmdDir = path.join(REPO_ROOT, '.claude', 'commands');
  for (const file of fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const text = fs.readFileSync(path.join(cmdDir, file), 'utf8');
    const used = [...text.matchAll(/node scripts\/housing\.mjs ([a-z-]+)/g)].map((m) => m[1]);
    ok(/^---\r?\ndescription:/.test(text) && used.every((u) => help.includes(u)), `/${file.replace('.md', '')} has a description and uses real commands`);
  }
  const prose = ['README.md', 'CLAUDE.md', 'AGENTS.md', ...fs.readdirSync(path.join(REPO_ROOT, 'docs')).map((f) => `docs/${f}`), ...fs.readdirSync(cmdDir).map((f) => `.claude/commands/${f}`)];
  ok(prose.every((f) => !fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').includes('TODO(author)')), 'No TODO(author) left');
  ok(prose.every((f) => !fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').includes('\u2014')), 'No em dashes in prose');

  console.log(`\nPASS: ${checks} checks`);
} finally {
  await db.close();
  if (control) { await control.query(`drop schema ${schema} cascade`); await control.end(); }
  fs.rmSync(temp, { recursive: true, force: true });
}
