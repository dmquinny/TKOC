import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attackBlocker,
  formatRatio,
  inRange,
  sortTargetsByCloseness,
  targetMatchesFilter,
  targetMatchesQuery,
  type TargetIntel,
} from '../src/lib/targets';

const target = (overrides: Partial<TargetIntel>): TargetIntel => ({
  id: 1,
  provinceName: 'Ashford',
  rulerName: 'Lord Ash',
  race: 'Human',
  kiID: 2,
  kingdomName: 'Ember',
  networth: 10_000,
  acres: 500,
  relation: 'neutral',
  networthRatio: 1,
  landRatio: 1,
  expectedLandPercent: 10,
  expectedAcresGained: 60,
  protection: false,
  vacation: false,
  attackPressure: 0,
  ...overrides,
});

test('closest networth matches come first, with yourself at the top', () => {
  const sorted = sortTargetsByCloseness([
    target({ id: 1, networthRatio: 2.5 }),
    target({ id: 2, networthRatio: 0.95 }),
    target({ id: 3, relation: 'self', networthRatio: 1 }),
    target({ id: 4, networthRatio: 1.2 }),
  ]);
  assert.deepEqual(sorted.map(entry => entry.id), [3, 2, 4, 1]);
});

test('a fair fight is between 70% and 145% of your networth', () => {
  assert.equal(inRange(target({ networthRatio: 0.7 })), true);
  assert.equal(inRange(target({ networthRatio: 1.45 })), true);
  assert.equal(inRange(target({ networthRatio: 1.5 })), false);
});

test('filters respect relation and range', () => {
  assert.equal(targetMatchesFilter(target({ relation: 'war' }), 'war'), true);
  assert.equal(targetMatchesFilter(target({ relation: 'neutral' }), 'war'), false);
  assert.equal(targetMatchesFilter(target({ relation: 'self', networthRatio: 1 }), 'range'), false);
  assert.equal(targetMatchesFilter(target({ relation: 'self' }), 'kingdom'), true);
  assert.equal(targetMatchesFilter(target({}), 'all'), true);
});

test('search matches name, ruler, kingdom, and race', () => {
  assert.equal(targetMatchesQuery(target({}), 'ash'), true);
  assert.equal(targetMatchesQuery(target({}), 'EMBER'), true);
  assert.equal(targetMatchesQuery(target({}), 'human'), true);
  assert.equal(targetMatchesQuery(target({}), 'orc'), false);
  assert.equal(targetMatchesQuery(target({}), '   '), true);
});

test('attack blockers explain why a province is off limits', () => {
  assert.equal(attackBlocker(target({})), null);
  assert.equal(attackBlocker(target({ relation: 'self' })), 'You cannot attack yourself.');
  assert.equal(attackBlocker(target({ relation: 'ally' })), 'Allied kingdoms cannot attack each other.');
  assert.equal(attackBlocker(target({ protection: true })), 'Under protection.');
  assert.equal(attackBlocker(target({ attackPressure: 5 })), 'Has suffered too many recent attacks.');
  assert.equal(attackBlocker(target({ attackPressure: 5, relation: 'kingdom' })), null);
});

test('ratios format to two decimals', () => {
  assert.equal(formatRatio(0.9), '0.90×');
  assert.equal(formatRatio(Number.NaN), '—');
});
