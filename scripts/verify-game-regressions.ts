import assert from 'node:assert/strict';
import { parseMobileNav } from '../src/lib/mobile-nav';
import { nextTickBoundary } from '../src/lib/tick-config';
import { combatProfile } from '../src/lib/tick/rules';
import { followingScheduledTick } from '../src/lib/tick/schedule';
import {
  legacyThieveryChancePerThousand,
  legacyThieveryMultiplier,
  legacyThieveryReputation,
  readyThieveryUnits,
} from '../src/lib/legacy-thievery';
import {
  legacyActionBlockedByOverpopulation,
  legacyPeasantHousing,
  legacySpecialistHousing,
} from '../src/lib/legacy-housing';
import {
  legacyMagicRank,
  legacyProvinceNetworth,
  legacyThieveryRank,
} from '../src/lib/legacy-networth';
import { legacyRaceScienceCategoryAllowed } from '../src/lib/science';

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

assert.equal(legacyThieveryReputation('AssasinateCouncil'), 10);
assert.equal(legacyThieveryReputation('SpyOnBuildings'), 0);
assert.equal(legacyRaceScienceCategoryAllowed('Dwarf', 'magic'), false);
assert.equal(legacyRaceScienceCategoryAllowed('Giant', 'thievery'), false);
assert.equal(legacyRaceScienceCategoryAllowed('Human', 'magic'), true);

const housingBuildings = [
  { num: 10, type: { className: 'Town Homes' } },
  { num: 5, type: { className: 'Wizard Towers' } },
  { num: 4, type: { className: 'Inn' } },
  { num: 2, type: { className: 'Dock' } },
];
assert.equal(legacyPeasantHousing(100, housingBuildings), 1815);
assert.equal(legacySpecialistHousing('wizards', housingBuildings), 170);
assert.equal(legacySpecialistHousing('thieves', housingBuildings), 140);
assert.equal(legacyActionBlockedByOverpopulation(1000, 101, 1000), true);
assert.equal(legacyActionBlockedByOverpopulation(1000, 100, 1000), false);

assert.equal(legacyThieveryRank(3000), 'Thief King');
assert.equal(legacyMagicRank(1750), 'High mage');
assert.equal(legacyProvinceNetworth({
  gold: 1000,
  food: 2000,
  metal: 1000,
  peasants: 100,
  acres: 10,
  buildings: 5,
  sciences: 2,
  military: [{ mID: 1, num: 100, type: { category: 'elite' } }],
  training: [{ mID: 1, num: 10 }],
}), 3428, 'Networth must use legacy resource, land, science, troop, and trainee values.');

console.log('Game regression invariants passed.');
