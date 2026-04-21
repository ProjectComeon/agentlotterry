import assert from 'node:assert/strict';
import {
  DEFAULT_PAGINATION_META,
  getPaginatedItems,
  getPaginatedMeta,
  isPaginatedResponse
} from '../src/utils/paginatedResponse.js';

assert.deepEqual(DEFAULT_PAGINATION_META, {
  page: 1,
  limit: 0,
  total: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false
});

assert.equal(isPaginatedResponse([]), false);
assert.equal(
  isPaginatedResponse({
    items: [1, 2],
    pagination: {
      page: 1
    }
  }),
  true
);

assert.deepEqual(
  getPaginatedItems({
    items: ['x'],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasPrevPage: false, hasNextPage: false }
  }),
  ['x']
);

assert.deepEqual(
  getPaginatedMeta(['x', 'y']),
  {
    page: 1,
    limit: 2,
    total: 2,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false
  }
);

assert.deepEqual(
  getPaginatedMeta({
    items: ['x', 'y'],
    pagination: {
      page: 3,
      limit: 10,
      total: 24,
      totalPages: 3,
      hasPrevPage: true,
      hasNextPage: false
    }
  }),
  {
    page: 3,
    limit: 10,
    total: 24,
    totalPages: 3,
    hasPrevPage: true,
    hasNextPage: false
  }
);

console.log('testPaginatedResponse passed');
