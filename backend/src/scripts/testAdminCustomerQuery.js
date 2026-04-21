const assert = require('assert');

const {
  buildAdminCustomerFilter,
  buildAdminCustomerSort,
  normalizeAdminCustomerQuery,
  sortAdminCustomerRowsByTotals
} = require('../utils/adminCustomerQuery');

assert.deepStrictEqual(
  normalizeAdminCustomerQuery({
    agentId: ' agent-1 ',
    search: '  alice  ',
    status: ' suspended ',
    sortBy: 'profit_desc'
  }),
  {
    agentId: 'agent-1',
    search: 'alice',
    status: 'suspended',
    sortBy: 'profit_desc'
  }
);

assert.deepStrictEqual(
  normalizeAdminCustomerQuery({
    status: 'unknown',
    sortBy: 'bad-sort'
  }),
  {
    agentId: '',
    search: '',
    status: '',
    sortBy: 'recent'
  }
);

const filter = buildAdminCustomerFilter({
  agentId: 'agent-1',
  search: 'alice',
  status: 'active'
});
assert.strictEqual(filter.role, 'customer');
assert.strictEqual(filter.agentId, 'agent-1');
assert.strictEqual(filter.status, 'active');
assert.ok(Array.isArray(filter.$or), 'search filter should include $or clauses');

const specialCharacterFilter = buildAdminCustomerFilter({ search: 'a[b' });
assert.ok(
  specialCharacterFilter.$or[0].name.test('a[b'),
  'search regex should treat special characters as literal text'
);

assert.deepStrictEqual(buildAdminCustomerSort('recent'), {
  updatedAt: -1,
  createdAt: -1,
  _id: -1
});
assert.deepStrictEqual(buildAdminCustomerSort('name_asc'), {
  name: 1,
  username: 1,
  _id: 1
});
assert.strictEqual(buildAdminCustomerSort('sales_desc'), null);

const rows = [
  { _id: 'a', updatedAt: new Date('2026-04-18T00:00:00Z') },
  { _id: 'b', updatedAt: new Date('2026-04-20T00:00:00Z') },
  { _id: 'c', updatedAt: new Date('2026-04-19T00:00:00Z') }
];
const totals = {
  a: { totalAmount: 100, totalWon: 30 },
  b: { totalAmount: 250, totalWon: 10 },
  c: { totalAmount: 250, totalWon: 90 }
};

assert.deepStrictEqual(
  sortAdminCustomerRowsByTotals(rows, totals, 'sales_desc').map((row) => row._id),
  ['b', 'c', 'a'],
  'sales sort should use totalAmount desc and recent tie-breaker'
);

assert.deepStrictEqual(
  sortAdminCustomerRowsByTotals(rows, totals, 'profit_desc').map((row) => row._id),
  ['b', 'c', 'a'],
  'profit sort should use totalAmount - totalWon desc'
);

console.log('testAdminCustomerQuery: ok');
