import assert from 'node:assert/strict';
import { buildInitialAuthState } from '../src/utils/authBootstrap.js';

const normalizeUser = (user) => {
  if (!user || !['admin', 'agent'].includes(user.role)) {
    return null;
  }

  return {
    ...user,
    role: user.role
  };
};

const noToken = buildInitialAuthState({
  token: '',
  storedUser: '',
  normalizeUser
});
assert.deepEqual(
  noToken,
  {
    user: null,
    loading: false,
    shouldRevalidate: false
  },
  'missing token should not block initial render'
);

const validStoredUser = buildInitialAuthState({
  token: 'token',
  storedUser: JSON.stringify({ id: 'u-1', role: 'admin', name: 'Tester' }),
  normalizeUser
});
assert.equal(validStoredUser.loading, false, 'stored valid user should skip blocking loading state');
assert.equal(validStoredUser.user?.id, 'u-1', 'stored user should hydrate initial auth state');
assert.equal(validStoredUser.shouldRevalidate, true, 'token-backed bootstrap should still revalidate');

const invalidStoredUser = buildInitialAuthState({
  token: 'token',
  storedUser: JSON.stringify({ id: 'u-2', role: 'customer', name: 'Blocked' }),
  normalizeUser
});
assert.deepEqual(
  invalidStoredUser,
  {
    user: null,
    loading: true,
    shouldRevalidate: true
  },
  'invalid stored user should fall back to blocking server validation'
);

console.log('testAuthBootstrap passed');
