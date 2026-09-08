import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildForecast, describeTicks, runwayTicks, type ForecastInput } from '../src/lib/forecast';

const base: ForecastInput = {
  gold: 10_000,
  food: 5_000,
  metal: 1_000,
  peasants: 1_400,
  incomeChange: 300,
  foodChange: -100,
  metalChange: 50,
  peasantChange: 12,
  aliveTicks: 5,
  vacation: false,
};

test('runway divides stock by the per-tick loss', () => {
  assert.equal(runwayTicks(1000, -100), 10);
  assert.equal(runwayTicks(950, -100), 9);
  assert.equal(runwayTicks(1000, 5), null);
  assert.equal(runwayTicks(0, -1), 0);
});

test('a province that has not ticked yet has no forecast', () => {
  const forecast = buildForecast({ ...base, aliveTicks: 0 });
  assert.equal(forecast.hasTicked, false);
  assert.equal(forecast.foodRunwayTicks, null);
  assert.equal(forecast.foodStatus, 'stable');
});

test('falling food is graded by how soon it runs out', () => {
  assert.equal(buildForecast(base).foodStatus, 'falling');
  assert.equal(buildForecast({ ...base, food: 2_000 }).foodStatus, 'critical');
  assert.equal(buildForecast({ ...base, food: 0 }).foodStatus, 'starving');
  assert.equal(buildForecast({ ...base, foodChange: 20 }).foodStatus, 'stable');
});

test('gold runway follows the same rule', () => {
  assert.equal(buildForecast(base).goldRunwayTicks, null);
  assert.equal(buildForecast({ ...base, incomeChange: -500 }).goldRunwayTicks, 20);
});

test('tick durations read naturally', () => {
  assert.equal(describeTicks(0), 'now');
  assert.equal(describeTicks(1), '1 tick');
  assert.equal(describeTicks(12), '12 ticks');
  assert.equal(describeTicks(24), '1 day');
  assert.equal(describeTicks(30), '1 day 6t');
  assert.equal(describeTicks(48), '2 days');
});
