import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTACK_DEFINITIONS,
  attackAvailable,
  attackTypeName,
  expectedLandGain,
  gaussianLandPercent,
  isAttackId,
  parseBattleUnits,
} from '../src/lib/combat';

test('land seizure peaks when the attacker is slightly smaller than the target', () => {
  const peak = gaussianLandPercent(1000, 1100);
  assert.ok(Math.abs(peak - 0.10225) < 1e-9, 'inside the optimal band the peak is 10.225%');
  assert.ok(gaussianLandPercent(1000, 3000) < 0.01, 'a much larger target yields almost nothing');
  assert.ok(gaussianLandPercent(3000, 1000) < 0.02, 'a much smaller target yields almost nothing');
});

test('expected land gain is at least one acre and returns with the bonus', () => {
  const gain = expectedLandGain(1000, 1100);
  assert.equal(gain.seized, 112);
  assert.equal(gain.gained, 140);
  assert.equal(gain.percent, 10.2);
  assert.deepEqual(expectedLandGain(1000, 0), { seized: 0, gained: 0, percent: 0 });
});

test('attack classes gate on legacy knowledge bits', () => {
  const none = { military: 0, infrastructure: 0, magic: 0, thievery: 0 };
  assert.equal(attackAvailable(ATTACK_DEFINITIONS[1], none), true);
  assert.equal(attackAvailable(ATTACK_DEFINITIONS[2], none), false);
  assert.equal(attackAvailable(ATTACK_DEFINITIONS[2], { ...none, military: 16 }), true);
  assert.equal(attackAvailable(ATTACK_DEFINITIONS[5], { ...none, military: 1 }), false);
  assert.equal(attackAvailable(ATTACK_DEFINITIONS[5], { ...none, military: 1, thievery: 1 }), true);
});

test('attack ids and names are stable', () => {
  assert.equal(isAttackId(1), true);
  assert.equal(isAttackId(3), false);
  assert.equal(attackTypeName(5), 'Pillage');
  assert.equal(attackTypeName(9), 'Attack');
  assert.equal(ATTACK_DEFINITIONS[1].legacyName, 'Ordinary Attack');
});

test('battle unit lines survive a round trip and reject junk', () => {
  const lines = parseBattleUnits(JSON.stringify([{ name: 'Legions', sent: 100, lost: 7 }, 'junk', { name: 5 }]));
  assert.deepEqual(lines, [{ name: 'Legions', sent: 100, lost: 7 }, { name: '5', sent: 0, lost: 0 }]);
  assert.deepEqual(parseBattleUnits('not json'), []);
  assert.deepEqual(parseBattleUnits(null), []);
});
