const assert = require('assert/strict');
const {
  buildResultSyncFeedSelection,
  createResultSyncExistingKey
} = require('../services/externalResultFeedService');
const { createBangkokDate } = require('../utils/bangkokTime');

const makeLotteryType = (code, drawHour, drawMinute = 0) => ({
  code,
  schedule: {
    type: 'daily',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    openLeadDays: 1,
    closeHour: Math.max(0, drawHour - 1),
    closeMinute: drawMinute,
    drawHour,
    drawMinute
  }
});

const configs = [
  { feedCode: 'due_feed', lotteryCode: 'due_lottery', marketName: 'Due', parser: 'simple' },
  { feedCode: 'future_feed', lotteryCode: 'future_lottery', marketName: 'Future', parser: 'simple' },
  { feedCode: 'stored_feed', lotteryCode: 'stored_lottery', marketName: 'Stored', parser: 'simple' }
];

const now = createBangkokDate(2026, 6, 30, 15, 36, 0);
const lotteryByCode = new Map([
  ['due_lottery', makeLotteryType('due_lottery', 15, 30)],
  ['future_lottery', makeLotteryType('future_lottery', 20, 0)],
  ['stored_lottery', makeLotteryType('stored_lottery', 15, 30)]
]);

const selection = buildResultSyncFeedSelection(configs, lotteryByCode, {
  now,
  existingRoundKeys: new Set([
    createResultSyncExistingKey('stored_feed', '2026-06-30')
  ]),
  windowAfterMs: 2 * 60 * 60 * 1000
});

assert.deepStrictEqual(
  selection.selectedConfigs.map((config) => config.feedCode),
  ['due_feed'],
  'scheduled sync should select only feeds in the current result window without stored snapshots'
);

assert.equal(selection.selectedConfigs[0].syncTargetRoundCode, '2026-06-30');
assert.equal(selection.totalFeeds, 3);
assert.equal(selection.selectedFeeds, 1);
assert.equal(selection.skippedFeeds, 2);
assert.equal(selection.skippedOutsideWindow, 1);
assert.equal(selection.skippedAlreadyStored, 1);

const dueReason = selection.decisions.find((decision) => decision.feedCode === 'due_feed');
assert.equal(dueReason.reason, 'due');
assert.equal(dueReason.roundCode, '2026-06-30');

const futureReason = selection.decisions.find((decision) => decision.feedCode === 'future_feed');
assert.equal(futureReason.reason, 'outside-result-window');

const storedReason = selection.decisions.find((decision) => decision.feedCode === 'stored_feed');
assert.equal(storedReason.reason, 'result-already-stored');

const forcedSelection = buildResultSyncFeedSelection(configs, lotteryByCode, {
  now,
  forceAllFeeds: true,
  existingRoundKeys: new Set([
    createResultSyncExistingKey('stored_feed', '2026-06-30')
  ])
});

assert.deepStrictEqual(
  forcedSelection.selectedConfigs.map((config) => config.feedCode),
  ['due_feed', 'future_feed', 'stored_feed'],
  'forceAllFeeds should preserve the old full-fetch behavior for manual recovery'
);

console.log('testResultSyncFeedSelection passed');
