import assert from 'node:assert/strict';
import {
  DEFAULT_MEMBER_LIST_FILTERS,
  areMemberListFiltersEqual,
  normalizeMemberListFilters
} from '../src/utils/memberListFilters.js';

assert.deepEqual(DEFAULT_MEMBER_LIST_FILTERS, {
  search: '',
  status: '',
  online: ''
});

assert.deepEqual(
  normalizeMemberListFilters({
    search: '  alice  ',
    status: ' active ',
    online: ' true '
  }),
  {
    search: 'alice',
    status: 'active',
    online: 'true'
  }
);

assert.equal(
  areMemberListFiltersEqual(
    { search: ' alice ', status: 'active', online: '' },
    { search: 'alice', status: 'active', online: '' }
  ),
  true
);

assert.equal(
  areMemberListFiltersEqual(
    { search: 'alice', status: 'active', online: '' },
    { search: 'alice', status: 'inactive', online: '' }
  ),
  false
);

console.log('testMemberListFilters passed');
