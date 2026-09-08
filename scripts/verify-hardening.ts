import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');
const migration = read('prisma/migrations/20260726090000_audit_hardening/migration.sql');
const createResearchIndex = migration.indexOf('CREATE UNIQUE INDEX `ResearchOrder_pID_key`');
const dropResearchIndex = migration.indexOf('DROP INDEX `ResearchOrder_pID_scID_key`');
assert.ok(createResearchIndex >= 0 && dropResearchIndex > createResearchIndex,
  'ResearchOrder must get a replacement pID index before the FK-supporting composite index is dropped.');
const reconciliation = read('prisma/migrations/20260726120000_reconcile_audit_schema/migration.sql');
assert.match(reconciliation, /information_schema\.COLUMNS/);
assert.match(reconciliation, /PREPARE reconcile_stmt FROM @ddl/);
assert.match(reconciliation, /ADD UNIQUE INDEX `ResearchOrder_pID_key`/);
assert.match(reconciliation, /CREATE TABLE IF NOT EXISTS `OperationalEvent`/);

for (const route of [
  'src/app/api/combat/attack/route.ts',
  'src/app/api/magic/cast/route.ts',
  'src/app/api/thievery/execute/route.ts',
  'src/app/api/science/route.ts',
  'src/app/api/military/route.ts',
  'src/app/api/aid/route.ts',
  'src/app/api/buildings/route.ts',
  'src/app/api/explore/route.ts',
]) {
  const source = read(route);
  assert.match(source, /withSerializableTransaction/, `${route} must use a serializable transaction.`);
  assert.match(source, /lockProvinceRows/, `${route} must lock the affected province rows.`);
}

const auth = read('src/lib/auth.ts');
assert.match(auth, /sessionVersion/);
assert.match(auth, /status === 'Banned'/);
const rateLimit = read('src/lib/rate-limit.ts');
assert.match(rateLimit, /INSERT IGNORE/);
assert.ok(
  rateLimit.indexOf('INSERT IGNORE') < rateLimit.indexOf('withSerializableTransaction(async tx'),
  'The rate-limit bucket must be seeded before its serializable locking transaction.',
);
const transactions = read('src/lib/transactions.ts');
assert.match(transactions, /1213/);
assert.match(transactions, /P2034/);
const tick = read('src/app/api/cron/tick/route.ts');
assert.match(tick, /finishTickMaintenance/);
const tickMaintenance = read('src/lib/tick/maintenance.ts');
assert.match(tickMaintenance, /cleanupKilledProvinces/);
assert.match(tickMaintenance, /attackPressure/);
assert.match(tickMaintenance, /operationalEvent\.deleteMany/);

for (const route of [
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/combat/attack/route.ts',
  'src/app/api/magic/cast/route.ts',
  'src/app/api/thievery/execute/route.ts',
  'src/app/api/cron/tick/route.ts',
]) {
  assert.match(read(route), /internalErrorResponse/, `${route} must return a traceable internal error.`);
}

console.log('Hardening and migration invariants passed.');
