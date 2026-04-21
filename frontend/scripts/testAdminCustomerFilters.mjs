import assert from 'node:assert/strict';
import {
  DEFAULT_ADMIN_CUSTOMER_FILTERS,
  areAdminCustomerFiltersEqual,
  normalizeAdminCustomerFilters
} from '../src/utils/adminCustomerFilters.js';

assert.deepEqual(DEFAULT_ADMIN_CUSTOMER_FILTERS, {
  search: '',
  agentId: '',
  status: '',
  sortBy: 'recent'
});

assert.deepEqual(
  normalizeAdminCustomerFilters({
    search: '  alice  ',
    agentId: ' agent-1 ',
    status: ' active ',
    sortBy: ' sales_desc '
  }),
  {
    search: 'alice',
    agentId: 'agent-1',
    status: 'active',
    sortBy: 'sales_desc'
  }
);

assert.deepEqual(
  normalizeAdminCustomerFilters({
    status: 'bad',
    sortBy: 'bad-sort'
  }),
  DEFAULT_ADMIN_CUSTOMER_FILTERS
);

assert.equal(
  areAdminCustomerFiltersEqual(
    { search: ' alice ', agentId: '', status: 'active', sortBy: 'recent' },
    { search: 'alice', agentId: '', status: 'active', sortBy: 'recent' }
  ),
  true
);

assert.equal(
  areAdminCustomerFiltersEqual(
    { search: 'alice', agentId: '', status: 'active', sortBy: 'recent' },
    { search: 'alice', agentId: '', status: 'active', sortBy: 'name_asc' }
  ),
  false
);

console.log('testAdminCustomerFilters passed');
