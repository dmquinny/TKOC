import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeMovement, rankKingdoms, rankMovement } from '../src/lib/ranking';

test('movement is the daily reference minus the current rank', () => {
  assert.equal(rankMovement(3, 5), 2);
  assert.equal(rankMovement(5, 3), -2);
  assert.equal(rankMovement(4, 4), 0);
  assert.equal(rankMovement(0, 4), null);
  assert.equal(rankMovement(4, 0), null);
});

test('movement is described for people', () => {
  assert.equal(describeMovement(null), 'New');
  assert.equal(describeMovement(0), 'Steady');
  assert.equal(describeMovement(3), 'Up 3');
  assert.equal(describeMovement(-1), 'Down 1');
});

test('kingdoms are totalled and ordered by networth', () => {
  const standings = rankKingdoms([
    { kiID: 1, networth: 100, acres: 10 },
    { kiID: 2, networth: 500, acres: 40 },
    { kiID: 1, networth: 300, acres: 30 },
    { kiID: 0, networth: 900, acres: 90 },
  ], new Map([[1, 'Iron'], [2, 'Ash']]));
  assert.deepEqual(standings, [
    { id: 2, name: 'Ash', provinces: 1, networth: 500, acres: 40 },
    { id: 1, name: 'Iron', provinces: 2, networth: 400, acres: 40 },
  ]);
});
