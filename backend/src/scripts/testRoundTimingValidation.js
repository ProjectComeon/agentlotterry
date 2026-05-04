const assert = require('assert');
const { createBangkokDate } = require('../utils/bangkokTime');

const {
  buildLotteryDefaultTimingUpdate,
  mergeLotteryDefinitionWithManualSchedule,
  normalizeRoundTimingPayload,
  selectCatalogActiveRound,
  __test
} = require('../services/catalogService');

assert.strictEqual(
  typeof buildLotteryDefaultTimingUpdate,
  'function',
  'Expected buildLotteryDefaultTimingUpdate to be exported'
);
assert.strictEqual(
  typeof mergeLotteryDefinitionWithManualSchedule,
  'function',
  'Expected mergeLotteryDefinitionWithManualSchedule to be exported'
);
assert.strictEqual(
  typeof normalizeRoundTimingPayload,
  'function',
  'Expected normalizeRoundTimingPayload to be exported'
);
assert.strictEqual(
  typeof selectCatalogActiveRound,
  'function',
  'Expected selectCatalogActiveRound to be exported'
);
assert.strictEqual(
  typeof __test.buildRoundTimingOverwriteOperations,
  'function',
  'Expected buildRoundTimingOverwriteOperations test helper to be exported'
);

const drawAt = new Date('2026-04-20T14:00:00.000Z');
const normalized = normalizeRoundTimingPayload({
  openAt: '2026-04-19T10:00:00.000Z',
  closeAt: '2026-04-20T13:30:00.000Z'
}, { drawAt });

assert.strictEqual(normalized.openAt.toISOString(), '2026-04-19T10:00:00.000Z');
assert.strictEqual(normalized.closeAt.toISOString(), '2026-04-20T13:30:00.000Z');

const rescheduledDraw = normalizeRoundTimingPayload({
  openAt: '2026-04-19T10:00:00.000Z',
  closeAt: '2026-04-21T13:30:00.000Z',
  drawAt: '2026-04-21T14:00:00.000Z'
}, { drawAt });

assert.strictEqual(rescheduledDraw.openAt.toISOString(), '2026-04-19T10:00:00.000Z');
assert.strictEqual(rescheduledDraw.closeAt.toISOString(), '2026-04-21T13:30:00.000Z');
assert.strictEqual(rescheduledDraw.drawAt.toISOString(), '2026-04-21T14:00:00.000Z');

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
    openAt: '2026-04-19T10:00:00.000Z',
    closeAt: '2026-04-21T14:30:00.000Z',
    drawAt: '2026-04-21T14:00:00.000Z'
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

const postponedThaiGovernmentRound = {
  code: '2026-05-01',
  openAt: new Date('2026-04-24T09:00:00.000Z'),
  closeAt: new Date('2026-05-01T08:30:00.000Z'),
  drawAt: new Date('2026-05-01T09:00:00.000Z'),
  resultPublishedAt: null,
  bettingOverride: 'auto'
};
const nextThaiGovernmentRound = {
  code: '2026-05-16',
  openAt: new Date('2026-05-09T09:00:00.000Z'),
  closeAt: new Date('2026-05-16T08:30:00.000Z'),
  drawAt: new Date('2026-05-16T09:00:00.000Z'),
  resultPublishedAt: null,
  bettingOverride: 'auto'
};

assert.strictEqual(
  selectCatalogActiveRound(
    [postponedThaiGovernmentRound, nextThaiGovernmentRound],
    new Date('2026-05-01T10:00:00.000Z')
  )?.code,
  '2026-05-01',
  'Expected recently overdue unpublished round to remain selected before the next round'
);

assert.strictEqual(
  selectCatalogActiveRound(
    [
      { ...postponedThaiGovernmentRound, resultPublishedAt: new Date('2026-05-01T10:30:00.000Z') },
      nextThaiGovernmentRound
    ],
    new Date('2026-05-01T10:00:00.000Z')
  )?.code,
  '2026-05-16',
  'Expected published old round to allow the next round selection'
);

assert.strictEqual(
  selectCatalogActiveRound(
    [
      {
        code: '2026-05-01',
        openAt: new Date('2026-04-24T09:00:00.000Z'),
        closeAt: new Date('2026-05-02T08:30:00.000Z'),
        drawAt: new Date('2026-05-02T09:00:00.000Z'),
        resultPublishedAt: null,
        bettingOverride: 'auto'
      },
      {
        ...nextThaiGovernmentRound,
        bettingOverride: 'open'
      }
    ],
    new Date('2026-05-02T01:00:00.000Z')
  )?.code,
  '2026-05-01',
  'Expected future manual-open round to not steal a currently open postponed round'
);

assert.strictEqual(
  selectCatalogActiveRound(
    [
      {
        code: '2026-05-01',
        openAt: new Date('2026-04-24T09:00:00.000Z'),
        closeAt: new Date('2026-05-02T08:30:00.000Z'),
        drawAt: new Date('2026-05-02T09:00:00.000Z'),
        resultPublishedAt: null,
        bettingOverride: 'auto'
      },
      {
        ...nextThaiGovernmentRound,
        bettingOverride: 'open'
      }
    ],
    new Date('2026-05-02T08:45:00.000Z')
  )?.code,
  '2026-05-01',
  'Expected future manual-open round to not steal a waiting-result postponed round'
);

assert.strictEqual(
  selectCatalogActiveRound(
    [
      {
        code: '2026-05-01',
        openAt: new Date('2026-04-24T09:00:00.000Z'),
        closeAt: new Date('2026-05-02T08:30:00.000Z'),
        drawAt: new Date('2026-05-02T09:00:00.000Z'),
        resultPublishedAt: null,
        bettingOverride: 'closed'
      },
      {
        ...nextThaiGovernmentRound,
        openAt: new Date('2026-05-02T09:01:00.000Z')
      }
    ],
    new Date('2026-05-02T10:00:00.000Z')
  )?.code,
  '2026-05-16',
  'Expected manually closed overdue round to not block the next open round'
);

assert.deepStrictEqual(
  buildLotteryDefaultTimingUpdate({
    closeAt: new Date('2026-05-02T08:40:00.000Z'),
    drawAt: new Date('2026-05-02T09:10:00.000Z')
  }),
  {
    'schedule.closeHour': 15,
    'schedule.closeMinute': 40,
    'schedule.drawHour': 16,
    'schedule.drawMinute': 10
  },
  'Expected Bangkok close/draw times to become lottery default schedule fields'
);

const catalogDefinition = {
  code: 'thai_government',
  schedule: {
    type: 'monthly',
    days: [1, 16],
    openLeadDays: 7,
    closeHour: 15,
    closeMinute: 30,
    drawHour: 16,
    drawMinute: 0
  }
};
const seededWithManualSchedule = mergeLotteryDefinitionWithManualSchedule(catalogDefinition, {
  isManualScheduleTiming: true,
  scheduleTimingUpdatedAt: new Date('2026-05-01T10:00:00.000Z'),
  scheduleTimingUpdatedBy: 'admin-id',
  schedule: {
    closeHour: 15,
    closeMinute: 40,
    drawHour: 16,
    drawMinute: 10
  }
});

assert.deepStrictEqual(
  {
    closeHour: seededWithManualSchedule.schedule.closeHour,
    closeMinute: seededWithManualSchedule.schedule.closeMinute,
    drawHour: seededWithManualSchedule.schedule.drawHour,
    drawMinute: seededWithManualSchedule.schedule.drawMinute,
    openLeadDays: seededWithManualSchedule.schedule.openLeadDays,
    isManualScheduleTiming: seededWithManualSchedule.isManualScheduleTiming
  },
  {
    closeHour: 15,
    closeMinute: 40,
    drawHour: 16,
    drawMinute: 10,
    openLeadDays: 7,
    isManualScheduleTiming: true
  },
  'Expected catalog seed payload to preserve manually configured close/draw defaults'
);

const overwriteOps = __test.buildRoundTimingOverwriteOperations(
  {
    _id: 'lottery-id',
    schedule: {
      type: 'daily',
      openLeadDays: 1,
      closeHour: 19,
      closeMinute: 10,
      drawHour: 19,
      drawMinute: 30
    }
  },
  [
    {
      code: '2026-05-05',
      title: 'Round 2026-05-05',
      openAt: new Date('2026-05-04T12:30:00.000Z'),
      closeAt: new Date('2026-05-05T12:10:00.000Z'),
      drawAt: new Date('2026-05-05T12:30:00.000Z')
    }
  ],
  {
    includeManualFutureRounds: true,
    now: new Date('2026-05-05T01:00:00.000Z'),
    userId: 'admin-id'
  }
);

assert.deepStrictEqual(
  overwriteOps[0].updateOne.filter.$or[1],
  {
    isManualTiming: true,
    resultLookupCode: { $in: ['', null] },
    drawAt: { $gte: createBangkokDate(2026, 5, 5, 0, 0) }
  },
  'Expected lottery default timing save to include future unpublished manual rounds'
);
assert.strictEqual(
  overwriteOps[0].updateOne.update.$set.isManualTiming,
  false,
  'Expected future manual rounds overwritten by lottery default timing to become schedule-driven'
);

console.log('Round timing validation tests passed');
