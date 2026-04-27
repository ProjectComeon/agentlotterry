require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const BetItem = require('../models/BetItem');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const MarketFeedResult = require('../models/MarketFeedResult');
const ResultRecord = require('../models/ResultRecord');
const {
  normalizeResultPayload,
  reconcileRoundSettlementById,
  validatePublishedResultPayload
} = require('../services/resultService');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const uniqueSorted = (value) => [...new Set((Array.isArray(value) ? value : [value])
  .flat()
  .map(normalizeDigits)
  .filter(Boolean))]
  .sort();

const comparableResultFields = [
  'firstPrize',
  'fourTop',
  'threeTop',
  'twoTop',
  'twoBottom',
  'threeFront',
  'threeBottom'
];

const comparableArrayFields = [
  'fourTopHits',
  'threeTopHits',
  'twoTopHits',
  'twoBottomHits',
  'threeFrontHits',
  'threeBottomHits',
  'runTop',
  'runBottom'
];

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const connect = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await connectDB();
};

const makeIssue = ({ severity = 'error', code, lotteryCode = '', roundCode = '', detail = {} }) => ({
  severity,
  code,
  lotteryCode,
  roundCode,
  detail
});

const compareResultToSafeFeed = async ({ record, lottery, round }) => {
  const issues = [];
  const safeFeed = await MarketFeedResult.findOne({
    $or: [
      { lotteryTypeId: lottery._id, roundCode: round.code, isSettlementSafe: true },
      { lotteryCode: lottery.code, roundCode: round.code, isSettlementSafe: true }
    ]
  })
    .sort({ resultPublishedAt: -1, updatedAt: -1 })
    .lean();

  if (!safeFeed) {
    if (record.sourceType === 'api') {
      issues.push(makeIssue({
        code: 'missing-safe-feed-snapshot',
        lotteryCode: lottery.code,
        roundCode: round.code,
        detail: {
          resultRecordId: record._id.toString(),
          sourceType: record.sourceType,
          sourceUrl: record.sourceUrl || ''
        }
      }));
    }
    return issues;
  }

  const normalizedRecord = normalizeResultPayload(record);
  const normalizedFeed = normalizeResultPayload(safeFeed);
  const mismatchedFields = [];

  comparableResultFields.forEach((field) => {
    const left = normalizeDigits(normalizedRecord[field]);
    const right = normalizeDigits(normalizedFeed[field]);
    if (left !== right) {
      mismatchedFields.push({ field, resultRecord: left, safeFeed: right });
    }
  });

  comparableArrayFields.forEach((field) => {
    const left = uniqueSorted(normalizedRecord[field]);
    const right = uniqueSorted(normalizedFeed[field]);
    if (left.join('|') !== right.join('|')) {
      mismatchedFields.push({ field, resultRecord: left, safeFeed: right });
    }
  });

  if (mismatchedFields.length) {
    issues.push(makeIssue({
      code: 'result-record-safe-feed-mismatch',
      lotteryCode: lottery.code,
      roundCode: round.code,
      detail: {
        resultRecordId: record._id.toString(),
        marketFeedResultId: safeFeed._id.toString(),
        fields: mismatchedFields
      }
    }));
  }

  return issues;
};

const auditPublishedResults = async () => {
  const issues = [];
  const records = await ResultRecord.find({ isPublished: true })
    .populate('lotteryTypeId', 'code name supportedBetTypes')
    .populate('drawRoundId', 'code title')
    .lean();

  for (const record of records) {
    const lottery = record.lotteryTypeId;
    const round = record.drawRoundId;
    const lotteryCode = lottery?.code || '';
    const roundCode = round?.code || '';

    if (!lottery || !round) {
      issues.push(makeIssue({
        code: 'orphan-result-record',
        lotteryCode,
        roundCode,
        detail: { resultRecordId: record._id.toString() }
      }));
      continue;
    }

    try {
      validatePublishedResultPayload(lottery, normalizeResultPayload(record));
    } catch (error) {
      issues.push(makeIssue({
        code: 'incomplete-published-result',
        lotteryCode,
        roundCode,
        detail: {
          resultRecordId: record._id.toString(),
          message: error.message,
          missing: error.details || []
        }
      }));
    }

    const feedIssues = await compareResultToSafeFeed({ record, lottery, round });
    issues.push(...feedIssues);
  }

  return {
    totalPublishedResults: records.length,
    issues
  };
};

const auditSettlements = async () => {
  const issues = [];
  const roundIds = await BetItem.distinct('drawRoundId', { status: 'submitted' });
  const publishedRecords = await ResultRecord.find({
    drawRoundId: { $in: roundIds },
    isPublished: true
  })
    .select('drawRoundId lotteryTypeId')
    .lean();
  const publishedRoundIds = new Set(publishedRecords.map((record) => toIdString(record.drawRoundId)));
  const missingPublishedRoundIds = roundIds
    .map(toIdString)
    .filter(Boolean)
    .filter((roundId) => !publishedRoundIds.has(roundId));

  for (const roundId of missingPublishedRoundIds) {
    const lockedCount = await BetItem.countDocuments({
      drawRoundId: roundId,
      status: 'submitted',
      $or: [
        { isLocked: true },
        { result: { $ne: 'pending' } },
        { payoutAppliedAmount: { $ne: 0 } }
      ]
    });

    if (lockedCount > 0) {
      const round = await DrawRound.findById(roundId).select('code lotteryTypeId').lean();
      const lottery = round?.lotteryTypeId
        ? await LotteryType.findById(round.lotteryTypeId).select('code name').lean()
        : null;
      issues.push(makeIssue({
        code: 'settled-items-without-published-result',
        lotteryCode: lottery?.code || '',
        roundCode: round?.code || '',
        detail: { roundId, lockedCount }
      }));
    }
  }

  const settlementSummaries = [];
  for (const record of publishedRecords) {
    const summary = await reconcileRoundSettlementById(record.drawRoundId);
    const round = await DrawRound.findById(record.drawRoundId).select('code').lean();
    const lottery = await LotteryType.findById(record.lotteryTypeId).select('code name').lean();

    settlementSummaries.push({
      lotteryCode: lottery?.code || '',
      roundCode: round?.code || summary.roundCode,
      totalItems: summary.totalItems,
      mismatchedItems: summary.mismatchedItems,
      expectedPayoutTotal: summary.expectedPayoutTotal || 0,
      appliedPayoutTotal: summary.appliedPayoutTotal || 0,
      ledgerEntryCount: summary.ledgerEntryCount || 0
    });

    if (summary.mismatchedItems > 0) {
      issues.push(makeIssue({
        code: 'settlement-reconcile-mismatch',
        lotteryCode: lottery?.code || '',
        roundCode: round?.code || summary.roundCode,
        detail: {
          totalItems: summary.totalItems,
          mismatchedItems: summary.mismatchedItems,
          expectedPayoutTotal: summary.expectedPayoutTotal,
          appliedPayoutTotal: summary.appliedPayoutTotal,
          ledgerEntryCount: summary.ledgerEntryCount,
          sample: summary.mismatches?.[0] || null
        }
      }));
    }
  }

  return {
    totalSubmittedRounds: roundIds.length,
    totalPublishedSubmittedRounds: publishedRecords.length,
    settlementSummaries,
    issues
  };
};

const run = async () => {
  const startedAt = new Date();
  await connect();

  try {
    const [publishedAudit, settlementAudit] = await Promise.all([
      auditPublishedResults(),
      auditSettlements()
    ]);
    const issues = [...publishedAudit.issues, ...settlementAudit.issues];
    const summary = {
      ok: issues.length === 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      counts: {
        totalPublishedResults: publishedAudit.totalPublishedResults,
        totalSubmittedRounds: settlementAudit.totalSubmittedRounds,
        totalPublishedSubmittedRounds: settlementAudit.totalPublishedSubmittedRounds,
        checkedSettledRounds: settlementAudit.settlementSummaries.length,
        issueCount: issues.length
      },
      settlementSummaries: settlementAudit.settlementSummaries.slice(0, 50),
      issues: issues.slice(0, 100)
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.ok ? 0 : 1;
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message
  }, null, 2));
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
