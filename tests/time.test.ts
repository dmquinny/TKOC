import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCountdown, tickDay, tickWeek, ticksToDuration } from '../src/lib/time';

test('countdowns show minutes and seconds, adding hours when needed', () => {
  assert.equal(formatCountdown(65_000), '1:05');
  assert.equal(formatCountdown(3_725_000), '1:02:05');
  assert.equal(formatCountdown(-5), '0:00');
});

test('tick spans convert to wall-clock durations', () => {
  assert.equal(ticksToDuration(1, 3600), '1 h');
  assert.equal(ticksToDuration(24, 3600), '24 h');
  assert.equal(ticksToDuration(72, 3600), '3 days');
  assert.equal(ticksToDuration(1, 60), '1 min');
  assert.equal(ticksToDuration(0, 3600), '0s');
});

test('week and day derive from the tick', () => {
  assert.equal(tickWeek(0), 1);
  assert.equal(tickWeek(168), 2);
  assert.equal(tickDay(0), 1);
  assert.equal(tickDay(24), 2);
  assert.equal(tickDay(167), 7);
});
