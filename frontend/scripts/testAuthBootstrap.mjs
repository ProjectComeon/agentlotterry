import assert from 'node:assert/strict';
import { buildInitialAuthState } from '../src/utils/authBootstrap.js';
import { getAppRouteForRole, getValidAppRole } from '../src/utils/roleRoutes.js';

const normalizeUser = (user) => {
  const role = getValidAppRole(user?.role);
  if (!user || !role) {
    return null;
  }

  return {
    ...user,
    role
  };
};

const emptyBootstrap = buildInitialAuthState({
  storedUser: '',
  normalizeUser
});
assert.deepEqual(
  emptyBootstrap,
  {
    user: null,
    loading: true,
    shouldRevalidate: true
  },
  'cookie auth bootstrap should block on /auth/me when no user is cached'
);

const validStoredUser = buildInitialAuthState({
  storedUser: JSON.stringify({ id: 'u-1', role: 'admin', name: 'Tester' }),
  normalizeUser
});
assert.equal(validStoredUser.loading, true, 'stored valid user should stay loading until cookie session revalidates');
assert.equal(validStoredUser.user?.id, 'u-1', 'stored user should hydrate while /auth/me revalidates');
assert.equal(validStoredUser.shouldRevalidate, true, 'cookie-backed bootstrap should revalidate');

const validMemberUser = buildInitialAuthState({
  storedUser: JSON.stringify({ id: 'u-member', role: 'customer', name: 'Member Tester' }),
  normalizeUser
});
assert.equal(validMemberUser.loading, true, 'stored customer user should stay loading until cookie session revalidates');
assert.equal(validMemberUser.user?.role, 'customer', 'customer role should hydrate for member routes');
assert.equal(getAppRouteForRole('customer'), '/member', 'customer users should land on member dashboard');

const invalidStoredUser = buildInitialAuthState({
  storedUser: JSON.stringify({ id: 'u-2', role: 'viewer', name: 'Blocked' }),
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