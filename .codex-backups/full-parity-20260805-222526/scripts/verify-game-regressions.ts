import assert from 'node:assert/strict';
import { parseMobileNav } from '../src/lib/mobile-nav';
import { nextTickBoundary } from '../src/lib/tick-config';
import { combatProfile } from '../src/lib/tick/rules';
import { followingScheduledTick } from '../src/lib/tick/schedule';
import {
  legacyThieveryChancePerThousand,
  legacyThieveryMultiplier,
  readyThieveryUnits,
} from '../src/lib/legacy-thievery';

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

assert.equal(
  legacyThieveryMultiplier({ effect: 'offense', raceName: 'Human', innCount: 100, acres: 1000 }),
  1.375,
  'Human offense and a 10% Inn bonus must multiply, matching the legacy Effect engine.',
);
assert.equal(
  legacyThieveryMultiplier({ effect: 'defense', raceName: 'Giant' }),
  1.8,
  'Giants must retain their legacy 80% thievery defense.',
);
assert.ok(
  Math.abs(legacyThieveryMultiplier({
    effect: 'loss',
    raceName: 'Human',
    sciencePercent: -30,
    advisorPercent: -30,
  }) - .3675) < Number.EPSILON,
  'Independent thief-loss reductions must multiply instead of being added.',
);
assert.equal(
  legacyThieveryChancePerThousand(2, 2, 20),
  600,
  'Operation difficulty must modify the attacker TPA before the opposed roll.',
);
assert.equal(
  readyThieveryUnits(5000, 1000, 1500),
  2500,
  'Only trained thieves currently at home may participate in an operation.',
);

console.log('Game regression invariants passed.');
