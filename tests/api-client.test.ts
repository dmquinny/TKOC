import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, authRedirectFor, errorMessage } from '../src/lib/client/api';

test('expired sessions go back to sign-in', () => {
  assert.equal(authRedirectFor(new ApiError('Unauthorized', 401)), '/');
});

test('a missing province goes to the founding screen', () => {
  assert.equal(authRedirectFor(new ApiError('No province found', 404)), '/province/create');
  assert.equal(authRedirectFor(new ApiError('Thread not found', 404)), null);
});

test('ordinary errors are shown in place', () => {
  assert.equal(authRedirectFor(new ApiError('Not enough troops', 400)), null);
  assert.equal(authRedirectFor(new Error('boom')), null);
});

test('errorMessage prefers the error text and falls back safely', () => {
  assert.equal(errorMessage(new Error('Not enough gold')), 'Not enough gold');
  assert.equal(errorMessage('weird'), 'Something went wrong.');
  assert.equal(errorMessage(null, 'Fallback'), 'Fallback');
});
