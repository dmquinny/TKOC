import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeFor, categoryFor, navLabelFor, visibleCategories } from '../src/lib/navigation';

test('the admin section is only listed for administrators', () => {
  assert.equal(visibleCategories(false).some(category => category.name === 'System'), false);
  assert.equal(visibleCategories(true).some(category => category.name === 'System'), true);
});

test('routes resolve to their labels and categories', () => {
  assert.equal(navLabelFor('/dashboard/war-room'), 'War Room');
  assert.equal(navLabelFor('/dashboard/unknown'), 'Overview');
  assert.equal(categoryFor('/dashboard/magic'), 'Covert Ops');
  assert.equal(categoryFor('/dashboard/nowhere'), 'Province');
});

test('only the routes with live counters carry a badge', () => {
  assert.equal(badgeFor('/dashboard/messages'), 'messages');
  assert.equal(badgeFor('/dashboard/war-room'), 'battles');
  assert.equal(badgeFor('/dashboard'), 'news');
  assert.equal(badgeFor('/dashboard/science'), undefined);
});
