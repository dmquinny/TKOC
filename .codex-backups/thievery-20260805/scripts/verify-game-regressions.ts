import assert from 'node:assert/strict';
import { parseMobileNav } from '../src/lib/mobile-nav';
import { nextTickBoundary } from '../src/lib/tick-config';
import { combatProfile } from '../src/lib/tick/rules';
import { followingScheduledTick } from '../src/lib/tick/schedule';

const hour = 60 * 60 * 1000;
const scheduled = new Date('2026-07-26T03:00:00.000Z');

assert.equal(
  followingScheduledTick(scheduled, new Date('2026-07-26T03:15:00.000Z'), hour).toISOString(),
  '2026-07-26T04:00:00.000Z',
  'An on-time tick must preserve the persisted hourly cadence.',
);
assert.equal(
  followingScheduledTick(scheduled, new Date('2026-07-26T06:20:00.000Z'), hour).toISOString(),
  nextTickBoundary(new Date('2026-07-26T06:20:00.000Z'), hour).toISOString(),
  'A delayed worker must skip offline production slots.',
);

assert.ok(combatProfile(2).loseDef > combatProfile(1).loseDef,
  'Massacre must remain the highest defender-casualty attack.');
assert.ok(combatProfile(5).resource > combatProfile(1).resource,
  'Pillage must remain the highest resource-plunder attack.');

assert.deepEqual(
  parseMobileNav('["overview","magic","thievery","messages"]'),
  ['overview', 'magic', 'thievery', 'messages'],
);
assert.deepEqual(
  parseMobileNav('["overview","overview","magic","messages"]'),
  ['overview', 'buildings', 'science', 'war-room'],
  'Duplicate mobile shortcuts must fall back to a safe configuration.',
);

console.log('Game regression invariants passed.');
