const assert = require('assert');

const {
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  buildPaginatedResult,
  parsePaginationQuery
} = require('../utils/pagination');

const basic = parsePaginationQuery({});
assert.deepStrictEqual(basic, {
  paginated: false,
  page: 1,
  limit: DEFAULT_PAGINATION_LIMIT,
  skip: 0
});

const explicit = parsePaginationQuery({
  paginated: 'true',
  page: '3',
  limit: '40'
});
assert.deepStrictEqual(explicit, {
  paginated: true,
  page: 3,
  limit: 40,
  skip: 80
});

const clamped = parsePaginationQuery({
  page: '-9',
  limit: String(MAX_PAGINATION_LIMIT + 50)
});
assert.deepStrictEqual(clamped, {
  paginated: true,
  page: 1,
  limit: MAX_PAGINATION_LIMIT,
  skip: 0
});

assert.deepStrictEqual(
  buildPaginatedResult(['a', 'b'], {
    total: 5,
    page: 2,
    limit: 2
  }),
  {
    items: ['a', 'b'],
    pagination: {
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasPrevPage: true,
      hasNextPage: true
    }
  }
);

assert.deepStrictEqual(
  buildPaginatedResult([], {
    total: 0,
    page: 1,
    limit: 20
  }),
  {
    items: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false
    }
  }
);

assert.deepStrictEqual(
  buildPaginatedResult(['a'], {
    total: 19,
    page: 1,
    limit: 18,
    totalPages: 2,
    hasNextPage: true
  }),
  {
    items: ['a'],
    pagination: {
      page: 1,
      limit: 18,
      total: 19,
      totalPages: 2,
      hasPrevPage: false,
      hasNextPage: true
    }
  }
);

console.log('testPaginationUtils: ok');
