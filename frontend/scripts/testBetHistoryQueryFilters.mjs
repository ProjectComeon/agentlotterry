import assert from 'node:assert/strict';
import {
  DEFAULT_BET_HISTORY_QUERY_FILTERS,
  areBetHistoryQueryFiltersEqual,
  normalizeBetHistoryQueryFilters
} from '../src/utils/betHistoryQueryFilters.js';

assert.deepEqual(DEFAULT_BET_HISTORY_QUERY_FILTERS, {
  roundDate: '',
  agentId: ''
});

assert.deepEqual(
  normalizeBetHistoryQueryFilters({
    roundDate: ' 2026-04-20 ',
    agentId: ' 123 '
  }),
  {
    roundDate: '2026-04-20',
    agentId: '123'
  }
);

assert.equal(
  areBetHistoryQueryFiltersEqual(
    { roundDate: ' 2026-04-20 ', agentId: '' },
    { roundDate: '2026-04-20', agentId: '' }
  ),
  true
);

assert.equal(
  areBetHistoryQueryFiltersEqual(
    { roundDate: '2026-04-20', agentId: '' },
    { roundDate: '2026-04-19', agentId: '' }
  ),
  false
);

console.log('testBetHistoryQueryFilters passed');
