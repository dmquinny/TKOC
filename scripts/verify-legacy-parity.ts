import assert from 'node:assert/strict';
import { ORIGINAL_BUILDINGS } from '../src/lib/buildings';
import {
  LEGACY_APOCALYPSE_TICKS,
  LEGACY_NORMAL_AGE_TICKS,
  LEGACY_PROVINCE_RENAMES_PER_AGE,
  LEGACY_PROTECTION_TICKS,
  LEGACY_SEASON_LENGTH,
  LEGACY_TICK_ORDER,
  LEGACY_TOTAL_AGE_TICKS,
  legacyKingProductionMultiplier,
  legacyRaceModifiers,
  legacySeasonForTick,
} from '../src/lib/legacy-rules';
import { ORIGINAL_MILITARY_TYPES } from '../src/lib/military';
import { ORIGINAL_SCIENCES } from '../src/lib/science';
import { distributeAcrossTicks } from '../src/lib/trickle';
import {
  activeSpellPercent,
  LEGACY_SPELLS,
  manaTransferReceived,
} from '../src/lib/legacy-magic';
import { LEGACY_THIEVERY_OPERATIONS } from '../src/lib/legacy-thievery';
import {
  canonicalKingdomPair,
  KINGDOM_CAP,
  KINGDOM_MEMBERSHIP_FIXED_FOR_AGE,
  requiredKingVotes,
} from '../src/lib/kingdom-rules';

assert.equal(LEGACY_TOTAL_AGE_TICKS, 1500);
assert.equal(LEGACY_NORMAL_AGE_TICKS, 1000);
assert.equal(LEGACY_APOCALYPSE_TICKS, 500);
assert.equal(LEGACY_PROTECTION_TICKS, 50);
assert.equal(LEGACY_PROVINCE_RENAMES_PER_AGE, 0);
assert.equal(LEGACY_SEASON_LENGTH, 96);
assert.deepEqual(
  LEGACY_TICK_ORDER.slice(0, 7),
  ['prepare', 'attack', 'military', 'triggeredEffects', 'explore', 'buildings', 'science'],
);

assert.equal(legacySeasonForTick(1), 'Spring');
assert.equal(legacySeasonForTick(96), 'Spring');
assert.equal(legacySeasonForTick(97), 'Summer');
assert.equal(legacySeasonForTick(193), 'Autumn');
assert.equal(legacySeasonForTick(289), 'Winter');
assert.equal(legacySeasonForTick(385), 'Spring');

assert.equal(legacyKingProductionMultiplier(1), 1.02);
assert.equal(legacyKingProductionMultiplier(2), 1.06);
assert.equal(legacyKingProductionMultiplier(3), 1.15);
assert.equal(legacyRaceModifiers('Human').researchTime, 0.7);
assert.equal(legacyRaceModifiers('Elf').manaCap, 110);
assert.equal(legacyRaceModifiers('Orc').attackTime, 0.85);
assert.equal(legacyRaceModifiers('Dwarf').peasantHousing, 1.2);
assert.equal(legacyRaceModifiers('Undead').foodIncome, 1.5);
assert.equal(legacyRaceModifiers('Giant').attack, 1.15);

assert.equal(ORIGINAL_BUILDINGS.length, 14);
assert.equal(ORIGINAL_MILITARY_TYPES.length, 36);
assert.equal(ORIGINAL_SCIENCES.length, 23);
assert.equal(LEGACY_SPELLS.length, 31);
assert.equal(new Set(LEGACY_SPELLS.map(spell => spell.id)).size, 31);
assert.ok(!LEGACY_SPELLS.some(spell => spell.className === 'CleansingSpell'));
assert.equal(LEGACY_SPELLS.find(spell => spell.className === 'ManaTransferSpell')?.mana, 2.5);
assert.equal(manaTransferReceived(70), 35);
assert.equal(manaTransferReceived(99), 49);
assert.equal(activeSpellPercent(
  [{ type: 'ResourceTeleportationSpell', magnitude: 100 }],
  'aidLoss',
), -70);
assert.equal(LEGACY_THIEVERY_OPERATIONS.length, 14);
assert.equal(new Set(LEGACY_THIEVERY_OPERATIONS.map(operation => operation.id)).size, 14);
assert.ok(!LEGACY_THIEVERY_OPERATIONS.some(operation => operation.className === 'RetributiveStrike'));
assert.equal(KINGDOM_CAP, 3);
assert.equal(KINGDOM_MEMBERSHIP_FIXED_FOR_AGE, true);
assert.deepEqual(canonicalKingdomPair(9, 4), [4, 9]);
assert.equal(requiredKingVotes(1), 1);
assert.equal(requiredKingVotes(2), 1);
assert.equal(requiredKingVotes(3), 2);
assert.equal(requiredKingVotes(5), 3);
for (const race of ['Human', 'Elf', 'Orc', 'Dwarf', 'Undead', 'Giant']) {
  const units = ORIGINAL_MILITARY_TYPES.filter(unit => unit.raceName === race);
  assert.equal(units.length, 6, `${race} should have six military types`);
  assert.deepEqual(
    new Set(units.map(unit => unit.category)),
    new Set(['soldiers', 'offense', 'defense', 'elite', 'thieves', 'wizards']),
  );
}

for (const [total, ticks] of [[1, 24], [23, 24], [100, 12], [10_000, 24]]) {
  const distribution = distributeAcrossTicks(total, ticks, () => 0.314159);
  assert.equal([...distribution.values()].reduce((sum, amount) => sum + amount, 0), total);
  assert.ok([...distribution.keys()].every(tick => tick >= 1 && tick <= ticks));
  assert.ok([...distribution.values()].every(amount => amount > 0));
}

console.log('Legacy parity invariants passed.');
