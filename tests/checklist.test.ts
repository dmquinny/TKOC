import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChecklist, checklistComplete, startingScienceCount, type ChecklistInput } from '../src/lib/checklist';

const fresh: ChecklistInput = {
  acres: 300,
  landUsed: 40,
  buildOrders: 0,
  researchOrders: 0,
  sciences: 0,
  raceName: 'Human',
  militaryOrders: 0,
  militaryTotal: 300,
  exploreOrders: 0,
  councilId: 0,
  inKingdom: true,
  kingdomChatMessages: 0,
};

test('a freshly founded province has every step open', () => {
  const items = buildChecklist(fresh);
  assert.equal(items.length, 6);
  assert.ok(items.every(item => !item.done));
  assert.equal(checklistComplete(items), false);
});

test('steps complete from real state, not clicks', () => {
  const items = buildChecklist({
    ...fresh,
    buildOrders: 3,
    researchOrders: 1,
    militaryOrders: 2,
    exploreOrders: 1,
    councilId: 1,
    kingdomChatMessages: 1,
  });
  assert.ok(items.every(item => item.done));
  assert.equal(checklistComplete(items), true);
});

test('dwarves start with mining and are not credited for it', () => {
  assert.equal(startingScienceCount('Dwarf'), 1);
  assert.equal(startingScienceCount('Elf'), 0);
  const dwarf = buildChecklist({ ...fresh, raceName: 'Dwarf', sciences: 1 });
  assert.equal(dwarf.find(item => item.id === 'research')?.done, false);
  const elf = buildChecklist({ ...fresh, raceName: 'Elf', sciences: 1 });
  assert.equal(elf.find(item => item.id === 'research')?.done, true);
});

test('independent provinces do not get the kingdom step', () => {
  const items = buildChecklist({ ...fresh, inKingdom: false });
  assert.equal(items.some(item => item.id === 'kingdom'), false);
});

test('fully developed land counts as built', () => {
  const items = buildChecklist({ ...fresh, landUsed: 300 });
  assert.equal(items.find(item => item.id === 'build')?.done, true);
});
