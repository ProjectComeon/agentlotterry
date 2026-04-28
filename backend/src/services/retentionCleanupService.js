const crypto = require('crypto');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const BettingDraftSession = require('../models/BettingDraftSession');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const MarketFeedResult = require('../models/MarketFeedResult');
const RetentionArchiveSummary = require('../models/RetentionArchiveSummary');
const ResultRecord = require('../models/ResultRecord');
const { createBangkokDate, formatBangkokDate, getBangkokParts } = require('../utils/bangkokTime');
const { incrementArchiveSummary } = require('./retentionArchiveService');

const DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS = 1;

let retentionTimer = null;
let retentionRunning = false;
let lastRunState = null;

const toPositiveInteger = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.floor(number);
};

const getRetentionCutoff = (now = new Date(), keepPreviousMonths = DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS) => {
  const monthsToKeep = toPositiveInteger(keepPreviousMonths, DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS);
  const { year, month } = getBangkokParts(now);
  let cutoffYear = year;
  let cutoffMonth = month - monthsToKeep;

  while (cutoffMonth <= 0) {
    cutoffMonth += 12;
    cutoffYear -= 1;
  }

  return createBangkokDate(cutoffYear, cutoffMonth, 1);
};

const getRetentionPolicy = ({ now = new Date(), keepPreviousMonths = DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS } = {}) => {
  const cutoff = getRetentionCutoff(now, keepPreviousMonths);

  return {
    keepPreviousMonths: toPositiveInteger(keepPreviousMonths, DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS),
    cutoff,
    cutoffBangkokDate: formatBangkokDate(cutoff)
  };
};

const buildOlderThanFilter = (field, cutoff) => ({
  [field]: { $lt: cutoff }
});

const buildArchiveRangeFilter = (field, cutoff, lowerBound = null) => ({
  [field]: {
    ...(lowerBound ? { $gte: lowerBound } : {}),
    $lt: cutoff
  }
});

const getArchiveLowerBound = async (cutoff) => {
  const summary = await RetentionArchiveSummary.findOne({
    scope: 'global',
    scopeKey: 'global'
  })
    .select('archivedBefore')
    .lean();

  const archivedBefore = summary?.archivedBefore ? new Date(summary.archivedBefore) : null;
  if (!archivedBefore || Number.isNaN(archivedBefore.getTime())) {
    return null;
  }

  return archivedBefore < cutoff ? archivedBefore : cutoff;
};

const summarizeBetItemsByScope = async (cutoff, lowerBound = null) => {
  const match = {
    status: 'submitted',
    ...buildArchiveRangeFilter('createdAt', cutoff, lowerBound)
  };

  const groupStage = (idSpec) => ([
    { $match: match },
    {
      $group: {
        _id: idSpec,
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        totalBets: { $sum: 1 },
        wonBets: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostBets: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
        pendingBets: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }
    }
  ]);

  const [
    globalRows,
    agentRows,
    customerRows,
    lotteryRows,
    agentCustomerRows,
    agentLotteryRows,
    customerLotteryRows
  ] = await Promise.all([
    BetItem.aggregate(groupStage(null)),
    BetItem.aggregate(groupStage('$agentId')),
    BetItem.aggregate(groupStage('$customerId')),
    BetItem.aggregate(groupStage('$lotteryTypeId')),
    BetItem.aggregate(groupStage({ agentId: '$agentId', customerId: '$customerId' })),
    BetItem.aggregate(groupStage({ agentId: '$agentId', lotteryTypeId: '$lotteryTypeId' })),
    BetItem.aggregate(groupStage({ customerId: '$customerId', lotteryTypeId: '$lotteryTypeId' }))
  ]);

  return {
    globalRows,
    agentRows,
    customerRows,
    lotteryRows,
    agentCustomerRows,
    agentLotteryRows,
    customerLotteryRows
  };
};

const summarizeSlipsByScope = async (cutoff, lowerBound = null) => {
  const match = {
    status: 'submitted',
    ...buildArchiveRangeFilter('createdAt', cutoff, lowerBound)
  };

  const groupStage = (idSpec) => ([
    { $match: match },
    {
      $group: {
        _id: idSpec,
        totalSlips: { $sum: 1 }
      }
    }
  ]);

  const [globalRows, agentRows, customerRows, lotteryRows, agentCustomerRows] = await Promise.all([
    BetSlip.aggregate(groupStage(null)),
    BetSlip.aggregate(groupStage('$agentId')),
    BetSlip.aggregate(groupStage('$customerId')),
    BetSlip.aggregate(groupStage('$lotteryTypeId')),
    BetSlip.aggregate(groupStage({ agentId: '$agentId', customerId: '$customerId' }))
  ]);

  return {
    globalRows,
    agentRows,
    customerRows,
    lotteryRows,
    agentCustomerRows
  };
};

const summarizeLedgerByScope = async (cutoff, lowerBound = null) => {
  const groupStage = (idSpec) => ([
    { $match: buildArchiveRangeFilter('createdAt', cutoff, lowerBound) },
    {
      $group: {
        _id: idSpec,
        ledgerCredit: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0]
          }
        },
        ledgerDebit: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0]
          }
        },
        ledgerCount: { $sum: 1 }
      }
    }
  ]);

  const [globalRows, userRows] = await Promise.all([
    CreditLedgerEntry.aggregate(groupStage(null)),
    CreditLedgerEntry.aggregate(groupStage('$userId'))
  ]);

  return {
    globalRows,
    userRows
  };
};

const mergeRows = (rows = [], keyFn = () => 'global') =>
  rows.reduce((acc, row) => {
    const key = keyFn(row);
    if (!key) return acc;
    acc[key] = {
      ...(acc[key] || {}),
      ...row,
      totalAmount: (acc[key]?.totalAmount || 0) + (row.totalAmount || 0),
      totalWon: (acc[key]?.totalWon || 0) + (row.totalWon || 0),
      totalBets: (acc[key]?.totalBets || 0) + (row.totalBets || 0),
      totalSlips: (acc[key]?.totalSlips || 0) + (row.totalSlips || 0),
      wonBets: (acc[key]?.wonBets || 0) + (row.wonBets || 0),
      lostBets: (acc[key]?.lostBets || 0) + (row.lostBets || 0),
      pendingBets: (acc[key]?.pendingBets || 0) + (row.pendingBets || 0),
      ledgerCredit: (acc[key]?.ledgerCredit || 0) + (row.ledgerCredit || 0),
      ledgerDebit: (acc[key]?.ledgerDebit || 0) + (row.ledgerDebit || 0),
      ledgerCount: (acc[key]?.ledgerCount || 0) + (row.ledgerCount || 0)
    };
    return acc;
  }, {});

const attachSlipCounts = (betRows = [], slipRows = [], keyFn) => {
  const byKey = mergeRows(betRows, keyFn);
  const slipCounts = mergeRows(slipRows, keyFn);

  Object.entries(slipCounts).forEach(([key, row]) => {
    byKey[key] = {
      ...(byKey[key] || row),
      totalSlips: row.totalSlips || 0
    };
  });

  return Object.values(byKey);
};

const archiveBetSummaries = async ({ cutoff, lowerBound, runId }) => {
  const [betSummary, slipSummary] = await Promise.all([
    summarizeBetItemsByScope(cutoff, lowerBound),
    summarizeSlipsByScope(cutoff, lowerBound)
  ]);

  const archiveTasks = [];
  const addTask = (scope, parts, totals) => {
    if (!totals || (!totals.totalBets && !totals.totalSlips)) return;
    archiveTasks.push(incrementArchiveSummary({ scope, parts, totals, cutoff, runId }));
  };

  attachSlipCounts(betSummary.globalRows, slipSummary.globalRows, () => 'global')
    .forEach((row) => addTask('global', {}, row));
  attachSlipCounts(betSummary.agentRows, slipSummary.agentRows, (row) => String(row._id || ''))
    .forEach((row) => addTask('agent', { agentId: row._id }, row));
  attachSlipCounts(betSummary.customerRows, slipSummary.customerRows, (row) => String(row._id || ''))
    .forEach((row) => addTask('customer', { customerId: row._id }, row));
  attachSlipCounts(betSummary.lotteryRows, slipSummary.lotteryRows, (row) => String(row._id || ''))
    .forEach((row) => addTask('lottery', { lotteryTypeId: row._id }, row));
  attachSlipCounts(
    betSummary.agentCustomerRows,
    slipSummary.agentCustomerRows,
    (row) => `${row._id?.agentId || ''}:${row._id?.customerId || ''}`
  ).forEach((row) => addTask('agent_customer', {
    agentId: row._id?.agentId,
    customerId: row._id?.customerId
  }, row));

  betSummary.agentLotteryRows.forEach((row) => addTask('agent_lottery', {
    agentId: row._id?.agentId,
    lotteryTypeId: row._id?.lotteryTypeId
  }, row));

  betSummary.customerLotteryRows.forEach((row) => addTask('customer_lottery', {
    customerId: row._id?.customerId,
    lotteryTypeId: row._id?.lotteryTypeId
  }, row));

  await Promise.all(archiveTasks);

  return {
    archiveTaskCount: archiveTasks.length,
    betItemCount: betSummary.globalRows[0]?.totalBets || 0,
    betSlipCount: slipSummary.globalRows[0]?.totalSlips || 0,
    totalAmount: betSummary.globalRows[0]?.totalAmount || 0,
    totalWon: betSummary.globalRows[0]?.totalWon || 0
  };
};

const archiveLedgerSummaries = async ({ cutoff, lowerBound, runId }) => {
  const ledgerSummary = await summarizeLedgerByScope(cutoff, lowerBound);
  const archiveTasks = [];

  ledgerSummary.globalRows.forEach((row) => {
    if (row.ledgerCount) {
      archiveTasks.push(incrementArchiveSummary({
        scope: 'wallet_global',
        parts: {},
        totals: row,
        cutoff,
        runId
      }));
    }
  });

  ledgerSummary.userRows.forEach((row) => {
    if (row.ledgerCount) {
      archiveTasks.push(incrementArchiveSummary({
        scope: 'wallet_user',
        parts: { userId: row._id },
        totals: row,
        cutoff,
        runId
      }));
    }
  });

  await Promise.all(archiveTasks);

  return {
    archiveTaskCount: archiveTasks.length,
    ledgerCount: ledgerSummary.globalRows[0]?.ledgerCount || 0,
    ledgerCredit: ledgerSummary.globalRows[0]?.ledgerCredit || 0,
    ledgerDebit: ledgerSummary.globalRows[0]?.ledgerDebit || 0
  };
};

const countDeleteTargets = async (cutoff) => {
  const oldRoundIds = await DrawRound.find(buildOlderThanFilter('drawAt', cutoff)).distinct('_id');
  const [
    betItems,
    betSlips,
    creditLedgerEntries,
    bettingDraftSessions,
    marketFeedResults,
    resultRecords,
    drawRounds
  ] = await Promise.all([
    BetItem.countDocuments(buildOlderThanFilter('createdAt', cutoff)),
    BetSlip.countDocuments(buildOlderThanFilter('createdAt', cutoff)),
    CreditLedgerEntry.countDocuments(buildOlderThanFilter('createdAt', cutoff)),
    BettingDraftSession.countDocuments(buildOlderThanFilter('updatedAt', cutoff)),
    MarketFeedResult.countDocuments({
      $or: [
        { resultPublishedAt: { $lt: cutoff } },
        { resultPublishedAt: null, createdAt: { $lt: cutoff } }
      ]
    }),
    ResultRecord.countDocuments({
      $or: [
        { drawRoundId: { $in: oldRoundIds } },
        { createdAt: { $lt: cutoff } }
      ]
    }),
    DrawRound.countDocuments({ _id: { $in: oldRoundIds } })
  ]);

  return {
    oldRoundIds,
    counts: {
      betItems,
      betSlips,
      creditLedgerEntries,
      bettingDraftSessions,
      marketFeedResults,
      resultRecords,
      drawRounds
    }
  };
};

const deleteTargets = async ({ cutoff, oldRoundIds }) => {
  const [
    betItems,
    betSlips,
    creditLedgerEntries,
    bettingDraftSessions,
    marketFeedResults,
    resultRecords,
    drawRounds
  ] = await Promise.all([
    BetItem.deleteMany(buildOlderThanFilter('createdAt', cutoff)),
    BetSlip.deleteMany(buildOlderThanFilter('createdAt', cutoff)),
    CreditLedgerEntry.deleteMany(buildOlderThanFilter('createdAt', cutoff)),
    BettingDraftSession.deleteMany(buildOlderThanFilter('updatedAt', cutoff)),
    MarketFeedResult.deleteMany({
      $or: [
        { resultPublishedAt: { $lt: cutoff } },
        { resultPublishedAt: null, createdAt: { $lt: cutoff } }
      ]
    }),
    ResultRecord.deleteMany({
      $or: [
        { drawRoundId: { $in: oldRoundIds } },
        { createdAt: { $lt: cutoff } }
      ]
    }),
    DrawRound.deleteMany({ _id: { $in: oldRoundIds } })
  ]);

  return {
    betItems: betItems.deletedCount || 0,
    betSlips: betSlips.deletedCount || 0,
    creditLedgerEntries: creditLedgerEntries.deletedCount || 0,
    bettingDraftSessions: bettingDraftSessions.deletedCount || 0,
    marketFeedResults: marketFeedResults.deletedCount || 0,
    resultRecords: resultRecords.deletedCount || 0,
    drawRounds: drawRounds.deletedCount || 0
  };
};

const runRetentionCleanup = async ({
  dryRun = true,
  now = new Date(),
  keepPreviousMonths = DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS,
  runId = crypto.randomUUID()
} = {}) => {
  const startedAt = new Date();
  const policy = getRetentionPolicy({ now, keepPreviousMonths });
  const { cutoff } = policy;
  const { oldRoundIds, counts } = await countDeleteTargets(cutoff);
  const archiveLowerBound = dryRun ? null : await getArchiveLowerBound(cutoff);
  const archivePreview = dryRun
    ? {}
    : {
      lowerBound: archiveLowerBound ? archiveLowerBound.toISOString() : null,
      bets: await archiveBetSummaries({ cutoff, lowerBound: archiveLowerBound, runId }),
      ledger: await archiveLedgerSummaries({ cutoff, lowerBound: archiveLowerBound, runId })
    };
  const deleted = dryRun ? {} : await deleteTargets({ cutoff, oldRoundIds });

  if (!dryRun) {
    try {
      const { clearAnalyticsReadCache } = require('./analyticsService');
      const { scheduleReadModelSnapshotRebuild } = require('./readModelSnapshotService');
      clearAnalyticsReadCache();
      scheduleReadModelSnapshotRebuild({
        reason: 'retention-cleanup',
        targets: ['catalog', 'dashboard', 'market'],
        delayMs: 1000
      });
    } catch (error) {
      console.warn(`Retention cleanup finished but snapshot/cache refresh failed: ${error.message}`);
    }
  }

  return {
    ok: true,
    dryRun,
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    policy: {
      keepPreviousMonths: policy.keepPreviousMonths,
      cutoff: cutoff.toISOString(),
      cutoffBangkokDate: policy.cutoffBangkokDate
    },
    archivePreview,
    deleteTargets: counts,
    deleted
  };
};

const runRetentionCleanupSafely = async (options = {}) => {
  if (retentionRunning) {
    return null;
  }

  retentionRunning = true;
  try {
    lastRunState = await runRetentionCleanup(options);
    return lastRunState;
  } catch (error) {
    lastRunState = {
      ok: false,
      error: error.message,
      completedAt: new Date().toISOString()
    };
    console.error(`Retention cleanup failed: ${error.message}`);
    return lastRunState;
  } finally {
    retentionRunning = false;
  }
};

const startRetentionAutoCleanup = ({
  intervalMs,
  startupDelayMs = 120000,
  keepPreviousMonths = DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS
} = {}) => {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }

  const safeIntervalMs = Math.max(60000, Number(intervalMs || 0));
  const runOptions = {
    dryRun: false,
    keepPreviousMonths
  };

  const startupTimer = setTimeout(() => {
    runRetentionCleanupSafely(runOptions);
  }, Math.max(0, Number(startupDelayMs) || 0));
  if (typeof startupTimer.unref === 'function') {
    startupTimer.unref();
  }

  retentionTimer = setInterval(() => {
    runRetentionCleanupSafely(runOptions);
  }, safeIntervalMs);

  if (typeof retentionTimer.unref === 'function') {
    retentionTimer.unref();
  }

  return retentionTimer;
};

const getRetentionCleanupState = () => ({
  running: retentionRunning,
  scheduled: Boolean(retentionTimer),
  lastRunState
});

module.exports = {
  DEFAULT_RETENTION_KEEP_PREVIOUS_MONTHS,
  getRetentionCleanupState,
  getRetentionCutoff,
  getRetentionPolicy,
  runRetentionCleanup,
  startRetentionAutoCleanup,
  __test: {
    buildOlderThanFilter,
    buildArchiveRangeFilter,
    getArchiveLowerBound,
    getRetentionCutoff,
    getRetentionPolicy
  }
};
