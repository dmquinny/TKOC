import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AGE_EVENTS, ageOutlook } from '../src/lib/apocalypse';

test('a fresh age counts down to the apocalypse at tick 1000', () => {
  const outlook = ageOutlook(0);
  assert.equal(outlook.phase, 'running');
  assert.equal(outlook.ticksUntilApocalypse, 1000);
  assert.equal(outlook.ticksUntilAgeEnd, 1500);
  assert.equal(outlook.next?.atTick, 1000);
  assert.equal(outlook.next?.inTicks, 1000);
  assert.equal(outlook.progressPercent, 0);
});

test('events match the tick engine thresholds', () => {
  assert.deepEqual(AGE_EVENTS.map(event => event.atTick), [1000, 1060, 1260, 1350, 1400, 1500]);
});

test('the phase flips to apocalypse once the normal age is over', () => {
  const outlook = ageOutlook(1000, 'Apocalypse');
  assert.equal(outlook.phase, 'apocalypse');
  assert.equal(outlook.ticksUntilApocalypse, 0);
  assert.equal(outlook.next?.atTick, 1060);
  assert.equal(outlook.next?.inTicks, 60);
});

test('past events drop out of the upcoming list', () => {
  const outlook = ageOutlook(1300);
  assert.deepEqual(outlook.upcoming.map(event => event.atTick), [1350, 1400, 1500]);
  assert.equal(outlook.ticksUntilAgeEnd, 200);
});

test('the phase string wins over the tick when the world says apocalypse', () => {
  assert.equal(ageOutlook(10, 'Apocalypse').phase, 'apocalypse');
  assert.equal(ageOutlook(1499).ticksUntilAgeEnd, 1);
});
