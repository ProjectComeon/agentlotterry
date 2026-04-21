const assert = require('assert');

const { __test } = require('../services/analyticsService');

const run = () => {
  assert(__test, '__test helpers should be exported');
  assert.strictEqual(
    typeof __test.buildGroupedTotalsMatch,
    'function',
    'buildGroupedTotalsMatch should be exported for regression coverage'
  );

  const scopedMatch = __test.buildGroupedTotalsMatch(
    'customerId',
    { agentId: '507f1f77bcf86cd799439011' },
    ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
  );

  assert.strictEqual(scopedMatch.status, 'submitted', 'submitted status should always be enforced');
  assert.strictEqual(
    String(scopedMatch.agentId),
    '507f1f77bcf86cd799439011',
    'existing agent filter should be preserved'
  );
  assert.deepStrictEqual(
    scopedMatch.customerId.$in.map((value) => String(value)),
    ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
    'scoped ids should be applied to the grouped field'
  );

  const unscopedMatch = __test.buildGroupedTotalsMatch('customerId', {}, []);
  assert.strictEqual(unscopedMatch.customerId, undefined, 'empty scoped ids should not add redundant filters');

  console.log('testAnalyticsScopedTotals: ok');
};

try {
  run();
} catch (error) {
  console.error('testAnalyticsScopedTotals: failed');
  console.error(error);
  process.exit(1);
}
