const assert = require('assert');

const { normalizeRoundTimingPayload } = require('../services/catalogService');

assert.strictEqual(
  typeof normalizeRoundTimingPayload,
  'function',
  'Expected normalizeRoundTimingPayload to be exported'
);

const drawAt = new Date('2026-04-20T14:00:00.000Z');
const normalized = normalizeRoundTimingPayload({
  openAt: '2026-04-19T10:00:00.000Z',
  closeAt: '2026-04-20T13:30:00.000Z'
}, { drawAt });

assert.strictEqual(normalized.openAt.toISOString(), '2026-04-19T10:00:00.000Z');
assert.strictEqual(normalized.closeAt.toISOString(), '2026-04-20T13:30:00.000Z');

assert.throws(
  () => normalizeRoundTimingPayload({
    openAt: '2026-04-20T13:30:00.000Z',
    closeAt: '2026-04-20T13:30:00.000Z'
  }, { drawAt }),
  /openAt must be before closeAt/
);

assert.throws(
  () => normalizeRoundTimingPayload({
    openAt: '2026-04-20T13:30:00.000Z',
    closeAt: '2026-04-20T14:30:00.000Z'
  }, { drawAt }),
  /closeAt must be before or equal to drawAt/
);

assert.throws(
  () => normalizeRoundTimingPayload({
    openAt: 'not-a-date',
    closeAt: '2026-04-20T13:30:00.000Z'
  }, { drawAt }),
  /openAt must be a valid date/
);

console.log('Round timing validation tests passed');
