const assert = require('assert');
const {
  getRetentionPolicy,
  __test
} = require('../services/retentionCleanupService');
const { formatBangkokDate } = require('../utils/bangkokTime');

const expectCutoff = (isoNow, expectedBangkokDate, keepPreviousMonths = 1) => {
  const policy = getRetentionPolicy({
    now: new Date(isoNow),
    keepPreviousMonths
  });

  assert.strictEqual(
    formatBangkokDate(new Date(policy.cutoff)),
    expectedBangkokDate,
    `${isoNow} should cut off before ${expectedBangkokDate}`
  );
};

expectCutoff('2026-05-15T12:00:00.000Z', '2026-04-01');
expectCutoff('2026-06-01T00:30:00.000Z', '2026-05-01');
expectCutoff('2026-01-12T10:00:00.000Z', '2025-12-01');
expectCutoff('2026-05-15T12:00:00.000Z', '2026-03-01', 2);

const cutoff = __test.getRetentionCutoff(new Date('2026-05-15T12:00:00.000Z'), 1);
const filter = __test.buildOlderThanFilter('createdAt', cutoff);
assert.deepStrictEqual(Object.keys(filter), ['createdAt']);
assert.strictEqual(filter.createdAt.$lt.toISOString(), cutoff.toISOString());

const leaseNow = new Date('2026-07-04T00:00:00.000Z');
const leaseQuery = __test.buildRetentionLeaseQuery(leaseNow);
assert.strictEqual(leaseQuery._id, 'global');
assert.strictEqual(leaseQuery.$or[1].expiresAt.$lte, leaseNow);
const leaseUpdate = __test.buildRetentionLeaseUpdate({
  runId: 'run-1',
  now: leaseNow,
  leaseMs: 120000
});
assert.strictEqual(leaseUpdate.$set.runId, 'run-1');
assert.strictEqual(leaseUpdate.$set.expiresAt.toISOString(), '2026-07-04T00:02:00.000Z');

console.log('Retention policy tests passed');
