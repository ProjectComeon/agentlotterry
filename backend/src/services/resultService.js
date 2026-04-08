const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const ResultRecord = require('../models/ResultRecord');
const User = require('../models/User');
const { createBangkokDate } = require('../utils/bangkokTime');
const { hasSameDigits } = require('../utils/numberHelpers');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const flattenValues = (value) => Array.isArray(value) ? value.flatMap(flattenValues) : [value];
const normalizeHitArray = (value) => [...new Set(flattenValues(value).map(normalizeDigits).filter(Boolean))];
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const makeSettlementGroupId = (roundCode = 'round') => `SET-${roundCode}-${new mongoose.Types.ObjectId().toString()}`;

const parseRoundCode = (roundCode) => {
  const match = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

const normalizeResultPayload = (payload = {}) => {
  const firstPrize = normalizeDigits(payload.firstPrize);
  const fourTopHits = normalizeHitArray(payload.fourTopHits || payload.fourTop || payload.full4 || (firstPrize ? [firstPrize.slice(-4)] : []));
  const threeTopHits = normalizeHitArray(payload.threeTopHits || payload.threeTop || (firstPrize ? [firstPrize.slice(-3)] : []));
  const twoTopHits = normalizeHitArray(payload.twoTopHits || payload.twoTop || (firstPrize ? [firstPrize.slice(-2)] : []));
  const twoBottomHits = normalizeHitArray(payload.twoBottomHits || payload.twoBottom);
  const threeFrontHits = normalizeHitArray(payload.threeFrontHits || payload.threeFront);
  const threeBottomHits = normalizeHitArray(payload.threeBottomHits || payload.threeBottom);
  const fourTop = fourTopHits[0] || '';
  const threeTop = threeTopHits[0] || '';
  const twoTop = twoTopHits[0] || '';
  const twoBottom = twoBottomHits[0] || '';
  const threeFront = threeFrontHits[0] || '';
  const threeBottom = threeBottomHits[0] || '';
  const runTop = (Array.isArray(payload.runTop) ? payload.runTop : String(payload.runTop || '').split(','))
    .map(normalizeDigits)
    .filter(Boolean);
  const runBottom = (Array.isArray(payload.runBottom) ? payload.runBottom : String(payload.runBottom || '').split(','))
    .map(normalizeDigits)
    .filter(Boolean);

  return {
    headline: normalizeDigits(payload.headline || firstPrize || twoBottom || threeTop),
    firstPrize,
      fourTop,
      fourTopHits,
      threeTop,
      threeFront,
      twoTop,
      twoBottom,
      threeBottom,
      threeTopHits,
      twoTopHits,
      twoBottomHits,
      threeFrontHits,
      threeBottomHits,
      runTop: runTop.length ? runTop : [...new Set(threeTopHits.join('').split('').filter(Boolean))],
      runBottom: runBottom.length ? runBottom : [...new Set(twoBottomHits.join('').split('').filter(Boolean))]
  };
};

const countNormalizedEntries = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeDigits).filter(Boolean).length;
  }

  return normalizeDigits(value) ? 1 : 0;
};

const mergeRequirement = (target, key, label, minCount = 1) => {
  const existing = target.get(key);
  if (!existing || existing.minCount < minCount) {
    target.set(key, { key, label, minCount });
  }
};

const getPublishedResultRequirements = (lotteryType) => {
  const supportedBetTypes = new Set(lotteryType?.supportedBetTypes || []);
  const requirements = new Map();

  if (lotteryType?.code === 'thai_government') {
    mergeRequirement(requirements, 'firstPrize', 'รางวัลที่ 1', 1);
  }

  if (supportedBetTypes.has('lao_set4')) {
    mergeRequirement(requirements, 'fourTopHits', '4 ตัวบน', 1);
  }

  if (supportedBetTypes.has('3top') || supportedBetTypes.has('3tod') || supportedBetTypes.has('run_top')) {
    mergeRequirement(requirements, 'threeTopHits', '3 ตัวบน', 1);
  }

  if (supportedBetTypes.has('2top') || supportedBetTypes.has('2tod')) {
    mergeRequirement(requirements, 'twoTopHits', '2 ตัวบน', 1);
  }

  if (supportedBetTypes.has('2bottom') || supportedBetTypes.has('run_bottom')) {
    mergeRequirement(requirements, 'twoBottomHits', '2 ตัวล่าง', 1);
  }

  if (supportedBetTypes.has('3front')) {
    mergeRequirement(
      requirements,
      'threeFrontHits',
      '3 ตัวหน้า',
      lotteryType?.code === 'thai_government' ? 2 : 1
    );
  }

  if (supportedBetTypes.has('3bottom')) {
    mergeRequirement(
      requirements,
      'threeBottomHits',
      '3 ตัวล่าง',
      lotteryType?.code === 'thai_government' ? 2 : 1
    );
  }

  return [...requirements.values()];
};

const buildIncompleteResultError = (lotteryType, missingRequirements) => {
  const missingLabels = missingRequirements.map((requirement) => (
    requirement.minCount > 1
      ? `${requirement.label} อย่างน้อย ${requirement.minCount} รางวัล`
      : requirement.label
  ));
  const error = new Error(
    `Result payload is incomplete for ${lotteryType?.code || 'unknown'}: missing ${missingLabels.join(', ')}`
  );

  error.statusCode = 400;
  error.code = 'INCOMPLETE_RESULT_PAYLOAD';
  error.details = missingRequirements;
  return error;
};

const validatePublishedResultPayload = (lotteryType, normalized) => {
  const missingRequirements = getPublishedResultRequirements(lotteryType).filter(
    (requirement) => countNormalizedEntries(normalized[requirement.key]) < requirement.minCount
  );

  if (missingRequirements.length) {
    throw buildIncompleteResultError(lotteryType, missingRequirements);
  }
};

const checkItemResult = (item, normalizedResult) => {
  const number = String(item.number || '').trim();

    switch (item.betType) {
      case 'lao_set4':
        return normalizedResult.fourTopHits.includes(number);
      case '3top':
        return normalizedResult.threeTopHits.includes(number);
    case '3front':
      return normalizedResult.threeFrontHits.includes(number);
      case '3bottom':
        return normalizedResult.threeBottomHits.includes(number);
    case '3tod':
      return normalizedResult.threeTopHits.some((value) => hasSameDigits(value, number));
    case '2top':
      return normalizedResult.twoTopHits.includes(number);
    case '2bottom':
      return normalizedResult.twoBottomHits.includes(number);
    case '2tod':
      return normalizedResult.twoTopHits.some((value) => hasSameDigits(value, number));
    case 'run_top':
      return normalizedResult.runTop.includes(number);
    case 'run_bottom':
      return normalizedResult.runBottom.includes(number);
    default:
      return false;
  }
};

const findRoundByCode = async (roundCode, lotteryCode = 'thai_government') => {
  const lotteryType = await LotteryType.findOne({ code: lotteryCode });
  if (!lotteryType) {
    throw new Error('Lottery type not found');
  }

  const round = await DrawRound.findOne({ lotteryTypeId: lotteryType._id, code: roundCode });
  if (!round) {
    throw new Error('Round not found');
  }

  return { lotteryType, round };
};

const ensureRoundForLottery = async (lotteryType, roundCode) => {
  let round = await DrawRound.findOne({
    lotteryTypeId: lotteryType._id,
    code: roundCode
  });

  if (round) {
    return round;
  }

  const parts = parseRoundCode(roundCode);
  if (!parts) {
    return null;
  }

  const schedule = lotteryType.schedule || {};
  const drawAt = createBangkokDate(
    parts.year,
    parts.month,
    parts.day,
    schedule.drawHour || 0,
    schedule.drawMinute || 0
  );
  const closeAt = createBangkokDate(
    parts.year,
    parts.month,
    parts.day,
    schedule.closeHour || schedule.drawHour || 0,
    schedule.closeMinute || 0
  );
  const openAt = new Date(drawAt.getTime() - (Number(schedule.openLeadDays) || 1) * 24 * 60 * 60 * 1000);
  const now = new Date();

  await DrawRound.updateOne(
    {
      lotteryTypeId: lotteryType._id,
      code: roundCode
    },
    {
      $setOnInsert: {
        title: `งวด ${roundCode}`,
        openAt,
        closeAt,
        drawAt,
        status: now > closeAt ? 'closed' : now >= openAt ? 'open' : 'upcoming',
        isActive: true
      }
    },
    { upsert: true }
  );

  round = await DrawRound.findOne({
    lotteryTypeId: lotteryType._id,
    code: roundCode
  });

  return round;
};

const upsertRoundResult = async ({
  roundId,
  lotteryTypeId,
  resultData,
  sourceType = 'manual',
  sourceUrl = '',
  isPublished = true
}) => {
  const round = await DrawRound.findById(roundId);
  if (!round) {
    throw new Error('Round not found');
  }

  const lotteryType = await LotteryType.findById(lotteryTypeId || round.lotteryTypeId);
  if (!lotteryType) {
    throw new Error('Lottery type not found');
  }

  const normalized = normalizeResultPayload(resultData);
  if (isPublished) {
    validatePublishedResultPayload(lotteryType, normalized);
  }

  const record = await ResultRecord.findOneAndUpdate(
    { drawRoundId: round._id },
    {
      $set: {
        lotteryTypeId: lotteryType._id,
        drawRoundId: round._id,
        headline: normalized.headline,
        firstPrize: normalized.firstPrize,
          twoTop: normalized.twoTop,
          twoBottom: normalized.twoBottom,
          threeTop: normalized.threeTop,
          threeFront: normalized.threeFront,
          threeBottom: normalized.threeBottom,
          threeTopHits: normalized.threeTopHits,
          twoTopHits: normalized.twoTopHits,
          twoBottomHits: normalized.twoBottomHits,
          threeFrontHits: normalized.threeFrontHits,
          threeBottomHits: normalized.threeBottomHits,
        runTop: normalized.runTop,
        runBottom: normalized.runBottom,
        sourceType,
        sourceUrl,
        isPublished
      }
    },
    {
      new: true,
      upsert: true
    }
  );

  await DrawRound.updateOne(
    { _id: round._id },
    {
      $set: {
        resultPublishedAt: isPublished ? new Date() : null,
        status: isPublished ? 'resulted' : 'closed'
      }
    }
  );

  return {
    record,
    round,
    lotteryType,
    normalized
  };
};

const syncLegacyThaiGovernmentResult = async (legacyResult, sourceType = 'legacy') => {
  const lotteryType = await LotteryType.findOne({ code: 'thai_government' });
  if (!lotteryType) return null;

  const round = await ensureRoundForLottery(lotteryType, legacyResult.roundDate);

  if (!round) return null;

  const threeFrontHits = normalizeHitArray(legacyResult.threeTopList || []);
  const threeBottomHits = normalizeHitArray(legacyResult.threeBotList || []);

  return upsertRoundResult({
    roundId: round._id,
    lotteryTypeId: lotteryType._id,
    sourceType,
    resultData: {
      headline: legacyResult.firstPrize || legacyResult.twoBottom,
        firstPrize: legacyResult.firstPrize,
        threeTop: legacyResult.firstPrize ? legacyResult.firstPrize.slice(-3) : '',
        twoTop: legacyResult.firstPrize ? legacyResult.firstPrize.slice(-2) : '',
        twoBottom: legacyResult.twoBottom,
        threeFront: threeFrontHits[0] || '',
        threeFrontHits,
        threeBottom: threeBottomHits[0] || '',
        threeBottomHits,
      runTop: legacyResult.runTop || [],
      runBottom: legacyResult.runBottom || []
    }
  });
};

const settleRoundById = async (roundId, { force = false } = {}) => {
  const session = await mongoose.startSession();

  try {
    let summary = null;

    await session.withTransaction(async () => {
      const round = await DrawRound.findById(roundId).session(session);
      if (!round) {
        throw new Error('Round not found');
      }

      const record = await ResultRecord.findOne({ drawRoundId: round._id, isPublished: true }).session(session);
      if (!record) {
        throw new Error('Published result not found for this round');
      }

      const normalized = normalizeResultPayload(record.toObject());
      const itemFilter = {
        drawRoundId: round._id,
        status: 'submitted'
      };

      if (!force) {
        itemFilter.isLocked = false;
      }

      const items = await BetItem.find(itemFilter).session(session);
      const customerIds = [...new Set(items.map((item) => toIdString(item.customerId)).filter(Boolean))];
      const customers = await User.find({ _id: { $in: customerIds } }).session(session);
      const customerMap = new Map(customers.map((customer) => [toIdString(customer), customer]));
      const settlementGroupId = makeSettlementGroupId(round.code);
      const payoutUpdatedAt = new Date();
      const ledgerEntries = [];

      let totalWon = 0;
      let totalLost = 0;
      let wonCount = 0;
      let lostCount = 0;
      let payoutEntryCount = 0;
      let payoutNetDelta = 0;

      for (const item of items) {
        const isWon = checkItemResult(item, normalized);
        const nextWonAmount = isWon ? toMoney(item.amount) * toMoney(item.payRate) : 0;
        const previousAppliedAmount = toMoney(item.payoutAppliedAmount);
        const payoutDelta = nextWonAmount - previousAppliedAmount;

        item.result = isWon ? 'won' : 'lost';
        item.wonAmount = nextWonAmount;
        item.isLocked = true;

        if (payoutDelta !== 0) {
          const customer = customerMap.get(toIdString(item.customerId));
          if (!customer) {
            throw new Error(`Customer not found for payout reconciliation (${item.customerId})`);
          }

          const balanceBefore = toMoney(customer.creditBalance);
          const balanceAfter = balanceBefore + payoutDelta;
          customer.creditBalance = balanceAfter;

          ledgerEntries.push({
            groupId: settlementGroupId,
            entryType: 'settlement',
            direction: payoutDelta > 0 ? 'credit' : 'debit',
            userId: customer._id,
            counterpartyUserId: null,
            performedByUserId: null,
            performedByRole: 'system',
            amount: Math.abs(payoutDelta),
            balanceBefore,
            balanceAfter,
            reasonCode: payoutDelta > 0 ? 'bet_result_payout' : 'bet_result_reversal',
            note: payoutDelta > 0
              ? `Prize payout for round ${round.code}`
              : `Prize reversal for round ${round.code}`,
            metadata: {
              roundId: round._id.toString(),
              roundCode: round.code,
              resultRecordId: record._id.toString(),
              slipId: toIdString(item.slipId),
              betItemId: item._id.toString(),
              previousAppliedAmount,
              nextWonAmount
            }
          });

          item.payoutAppliedAmount = nextWonAmount;
          item.payoutLedgerGroupId = settlementGroupId;
          item.payoutUpdatedAt = payoutUpdatedAt;
          payoutEntryCount++;
          payoutNetDelta += payoutDelta;
        }

        await item.save({ session });

        if (isWon) {
          totalWon += item.wonAmount;
          wonCount++;
        } else {
          totalLost += item.amount;
          lostCount++;
        }
      }

      await Promise.all(
        [...customerMap.values()]
          .filter((customer) => customer.isModified('creditBalance'))
          .map((customer) => customer.save({ session }))
      );

      if (ledgerEntries.length) {
        await CreditLedgerEntry.insertMany(ledgerEntries, { session });
      }

      const legacyGovernmentResult = await LotteryResult.findOne({ roundDate: round.code }).session(session);
      if (legacyGovernmentResult) {
        legacyGovernmentResult.isCalculated = true;
        await legacyGovernmentResult.save({ session });
      }

      summary = {
        roundId: round._id.toString(),
        roundCode: round.code,
        totalItems: items.length,
        wonCount,
        lostCount,
        totalWon,
        totalLost,
        netProfit: totalLost - totalWon,
        payoutEntryCount,
        payoutNetDelta,
        payoutGroupId: ledgerEntries.length ? settlementGroupId : ''
      };
    });

    return summary;
  } finally {
    await session.endSession();
  }
};

const settleRoundByCode = async (roundCode, lotteryCode = 'thai_government', options = {}) => {
  const { round } = await findRoundByCode(roundCode, lotteryCode);
  return settleRoundById(round._id, options);
};

const getRoundResult = async (roundId) => {
  const record = await ResultRecord.findOne({ drawRoundId: roundId })
    .populate('lotteryTypeId', 'code name shortName')
    .populate('drawRoundId', 'code title drawAt closeAt resultPublishedAt');

  if (!record) {
    return null;
  }

  return {
    id: record._id.toString(),
    headline: record.headline,
    firstPrize: record.firstPrize,
    twoTop: record.twoTop,
      twoBottom: record.twoBottom,
      threeTop: record.threeTop,
      threeFront: record.threeFront,
      threeBottom: record.threeBottom,
      threeTopHits: record.threeTopHits || [],
      twoTopHits: record.twoTopHits || [],
      twoBottomHits: record.twoBottomHits || [],
      threeFrontHits: record.threeFrontHits || [],
      threeBottomHits: record.threeBottomHits || [],
    runTop: record.runTop,
    runBottom: record.runBottom,
    sourceType: record.sourceType,
    sourceUrl: record.sourceUrl,
    isPublished: record.isPublished,
    lottery: record.lotteryTypeId ? {
      id: record.lotteryTypeId._id.toString(),
      code: record.lotteryTypeId.code,
      name: record.lotteryTypeId.name,
      shortName: record.lotteryTypeId.shortName
    } : null,
    round: record.drawRoundId ? {
      id: record.drawRoundId._id.toString(),
      code: record.drawRoundId.code,
      title: record.drawRoundId.title,
      drawAt: record.drawRoundId.drawAt,
      closeAt: record.drawRoundId.closeAt,
      resultPublishedAt: record.drawRoundId.resultPublishedAt
    } : null
  };
};

module.exports = {
  ensureRoundForLottery,
  checkItemResult,
  findRoundByCode,
  normalizeResultPayload,
  validatePublishedResultPayload,
  upsertRoundResult,
  syncLegacyThaiGovernmentResult,
  settleRoundById,
  settleRoundByCode,
  getRoundResult
};
