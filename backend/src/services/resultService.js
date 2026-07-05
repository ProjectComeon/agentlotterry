const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const PendingPayout = require('../models/PendingPayout');
const ResultRecord = require('../models/ResultRecord');
const User = require('../models/User');
const { LAO_SET_PRIZE_RATES, LAO_SET_UNIT_PRICE } = require('../constants/betting');
const { createBangkokDate } = require('../utils/bangkokTime');
const { hasSameDigits } = require('../utils/numberHelpers');
const {
  releaseAgentStakeToAvailable,
  reverseAgentStakeReleaseToHeld,
  payPayoutFromAgent,
  reversePaidPayoutToAgent,
  createPendingPayoutForItem,
  cancelPendingPayoutForItem,
  cancelLinkedPaidPayout
} = require('./agentFinancialService');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const flattenValues = (value) => Array.isArray(value) ? value.flatMap(flattenValues) : [value];
const normalizeHitArray = (value) => [...new Set(flattenValues(value).map(normalizeDigits).filter(Boolean))];
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const LAO_SET_BET_TYPE = 'lao_set4';

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

const uniqueNormalizedValues = (...values) => [...new Set(flattenValues(values).map(normalizeDigits).filter(Boolean))];

const getLaoSetPrizeMatch = (item, normalizedResult) => {
  const number = normalizeDigits(item?.number);
  if (number.length !== 4) {
    return null;
  }

  const fourTopHits = uniqueNormalizedValues(
    normalizedResult.fourTopHits,
    normalizedResult.fourTop,
    normalizedResult.firstPrize ? normalizeDigits(normalizedResult.firstPrize).slice(-4) : ''
  ).filter((value) => value.length === 4);

  const firstFourTop = fourTopHits[0] || '';
  const threeStraightNumber = number.slice(-3);
  const twoFrontNumber = number.slice(0, 2);
  const twoBackNumber = number.slice(-2);
  const threeTopHits = uniqueNormalizedValues(
    normalizedResult.threeTopHits,
    normalizedResult.threeTop,
    firstFourTop ? firstFourTop.slice(-3) : ''
  ).filter((value) => value.length === 3);
  const twoFrontHits = uniqueNormalizedValues(
    normalizedResult.twoBottomHits,
    firstFourTop ? firstFourTop.slice(0, 2) : ''
  ).filter((value) => value.length === 2);
  const twoBackHits = uniqueNormalizedValues(
    normalizedResult.twoTopHits,
    normalizedResult.twoTop,
    firstFourTop ? firstFourTop.slice(-2) : ''
  ).filter((value) => value.length === 2);

  if (fourTopHits.includes(number)) {
    return { prizeKey: 'fourStraight', prizeAmount: LAO_SET_PRIZE_RATES.fourStraight };
  }

  if (threeTopHits.includes(threeStraightNumber)) {
    return { prizeKey: 'threeStraight', prizeAmount: LAO_SET_PRIZE_RATES.threeStraight };
  }

  if (fourTopHits.some((value) => hasSameDigits(value, number))) {
    return { prizeKey: 'fourTod', prizeAmount: LAO_SET_PRIZE_RATES.fourTod };
  }

  if (threeTopHits.some((value) => hasSameDigits(value, threeStraightNumber))) {
    return { prizeKey: 'threeTod', prizeAmount: LAO_SET_PRIZE_RATES.threeTod };
  }

  if (twoFrontHits.includes(twoFrontNumber)) {
    return { prizeKey: 'twoFront', prizeAmount: LAO_SET_PRIZE_RATES.twoFront };
  }

  if (twoBackHits.includes(twoBackNumber)) {
    return { prizeKey: 'twoBack', prizeAmount: LAO_SET_PRIZE_RATES.twoBack };
  }

  return null;
};

const getLaoSetQuantity = (item) => Math.floor(toMoney(item?.amount) / LAO_SET_UNIT_PRICE);

const calculateItemWonAmount = (item, normalizedResult) => {
  if (item?.betType === LAO_SET_BET_TYPE) {
    const match = getLaoSetPrizeMatch(item, normalizedResult);
    const quantity = getLaoSetQuantity(item);
    return match && quantity > 0 ? match.prizeAmount * quantity : 0;
  }

  return checkItemResult(item, normalizedResult) ? toMoney(item.amount) * toMoney(item.payRate) : 0;
};

const checkItemResult = (item, normalizedResult) => {
  const number = String(item.number || '').trim();

    switch (item.betType) {
      case 'lao_set4':
        return Boolean(getLaoSetPrizeMatch(item, normalizedResult));
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

const resolveRoundForResultCode = async (lotteryType, resultRoundCode) => {
  if (!lotteryType || !resultRoundCode) {
    return null;
  }

  const exactRound = await DrawRound.findOne({
    lotteryTypeId: lotteryType._id,
    code: resultRoundCode
  });
  if (exactRound) {
    return exactRound;
  }

  const explicitLookupRound = await DrawRound.findOne({
    lotteryTypeId: lotteryType._id,
    resultLookupCode: resultRoundCode
  }).sort({ code: 1 });
  if (explicitLookupRound) {
    return explicitLookupRound;
  }

  const parts = parseRoundCode(resultRoundCode);
  if (!parts) {
    return null;
  }

  const dayStart = createBangkokDate(parts.year, parts.month, parts.day, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return DrawRound.findOne({
    lotteryTypeId: lotteryType._id,
    code: { $ne: resultRoundCode },
    isManualTiming: true,
    drawAt: { $gte: dayStart, $lt: dayEnd }
  }).sort({ code: 1 });
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

  const round = await resolveRoundForResultCode(lotteryType, legacyResult.roundDate)
    || await ensureRoundForLottery(lotteryType, legacyResult.roundDate);

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

const loadRoundForSettlement = async (roundId, session) => {
  const round = await DrawRound.findById(roundId).session(session);
  if (!round) {
    const error = new Error('Round not found');
    error.statusCode = 404;
    throw error;
  }

  return round;
};

const loadPublishedResultForRound = async (roundId, session) => {
  const record = await ResultRecord.findOne({ drawRoundId: roundId, isPublished: true }).session(session);
  if (!record) {
    const error = new Error('Published result not found for this round');
    error.statusCode = 409;
    throw error;
  }

  return record;
};

const hasRoundItems = async (roundId, session, filter = {}) => {
  const item = await BetItem.findOne({
    drawRoundId: roundId,
    status: 'submitted',
    ...filter
  })
    .select('_id')
    .session(session)
    .lean();

  return Boolean(item);
};

const loadRoundItemsWithCustomers = async (roundId, session, filter = {}) => {
  const items = await BetItem.find({
    drawRoundId: roundId,
    status: 'submitted',
    ...filter
  }).session(session);
  const customerIds = [...new Set(items.map((item) => toIdString(item.customerId)).filter(Boolean))];
  const customers = await User.find({ _id: { $in: customerIds } }).session(session);
  const customerMap = new Map(customers.map((customer) => [toIdString(customer), customer]));

  return { items, customerMap };
};

const saveModifiedCustomers = async (customerMap, session) => {
  const dirtyCustomers = [...customerMap.values()].filter((customer) => customer.isModified('creditBalance'));
  if (!dirtyCustomers.length) {
    return;
  }

  await Promise.all(dirtyCustomers.map((customer) => customer.save({ session })));
};

const applyRoundSettlement = async (roundId, { force = false, session }) => {
  const round = await loadRoundForSettlement(roundId, session);
  const record = await loadPublishedResultForRound(round._id, session);
  const normalized = normalizeResultPayload(record.toObject());
  const itemFilter = force ? {} : { isLocked: false };
  const hasItems = await hasRoundItems(round._id, session, itemFilter);

  if (!hasItems) {
    const legacyGovernmentResult = await LotteryResult.findOne({ roundDate: round.code }).session(session);
    if (legacyGovernmentResult) {
      legacyGovernmentResult.isCalculated = true;
      await legacyGovernmentResult.save({ session });
    }

    return {
      roundId: round._id.toString(),
      roundCode: round.code,
      totalItems: 0,
      wonCount: 0,
      lostCount: 0,
      totalWon: 0,
      totalLost: 0,
      netProfit: 0,
      payoutEntryCount: 0,
      payoutNetDelta: 0,
      pendingPayoutCount: 0,
      pendingPayoutTotal: 0,
      releasedStakeTotal: 0,
      payoutGroupId: ''
    };
  }

  const { items, customerMap } = await loadRoundItemsWithCustomers(round._id, session, itemFilter);
  const payoutUpdatedAt = new Date();
  const payoutGroupIds = [];

  let totalWon = 0;
  let totalLost = 0;
  let wonCount = 0;
  let lostCount = 0;
  let payoutEntryCount = 0;
  let payoutNetDelta = 0;
  let pendingPayoutCount = 0;
  let pendingPayoutTotal = 0;
  let releasedStakeTotal = 0;

  for (const item of items) {
    const wasLocked = Boolean(item.isLocked);
    const nextWonAmount = calculateItemWonAmount(item, normalized);
    const isWon = nextWonAmount > 0;
    const previousAppliedAmount = toMoney(item.payoutAppliedAmount);
    const payoutDelta = nextWonAmount - previousAppliedAmount;

    if (!wasLocked) {
      await releaseAgentStakeToAvailable({ item, round, record, session });
      releasedStakeTotal += toMoney(item.amount);
    }

    item.result = isWon ? 'won' : 'lost';
    item.wonAmount = nextWonAmount;
    item.isLocked = true;

    if (isWon && payoutDelta > 0) {
      const hasExistingPendingPayout = item.payoutStatus === 'pending';
      const payment = hasExistingPendingPayout
        ? null
        : await payPayoutFromAgent({
          item,
          round,
          record,
          amount: payoutDelta,
          session
        });

      if (payment) {
        item.payoutAppliedAmount = nextWonAmount;
        item.payoutLedgerGroupId = payment.groupId;
        item.payoutStatus = 'paid';
        item.pendingPayoutId = null;
        item.payoutUpdatedAt = payoutUpdatedAt;
        payoutEntryCount++;
        payoutNetDelta += payoutDelta;
        payoutGroupIds.push(payment.groupId);
      } else {
        await createPendingPayoutForItem({ item, round, record, amount: payoutDelta, session });
        item.payoutAppliedAmount = previousAppliedAmount;
        item.payoutUpdatedAt = payoutUpdatedAt;
        pendingPayoutCount++;
        pendingPayoutTotal += payoutDelta;
      }
    } else if (payoutDelta < 0) {
      const reversedAmount = Math.abs(payoutDelta);
      const reversal = await reversePaidPayoutToAgent({ item, round, amount: reversedAmount, session });
      if (reversal) {
        payoutEntryCount++;
        payoutNetDelta += payoutDelta;
        payoutGroupIds.push(reversal.groupId);
      }
      item.payoutAppliedAmount = nextWonAmount;
      item.payoutLedgerGroupId = reversal?.groupId || item.payoutLedgerGroupId;
      item.payoutStatus = nextWonAmount > 0 ? 'paid' : 'none';
      item.payoutUpdatedAt = payoutUpdatedAt;
      if (nextWonAmount === 0) {
        await cancelLinkedPaidPayout({ item, session });
        item.pendingPayoutId = null;
      }
    } else if (isWon && previousAppliedAmount > 0) {
      item.payoutStatus = 'paid';
      item.payoutUpdatedAt = item.payoutUpdatedAt || payoutUpdatedAt;
    } else if (!isWon) {
      await cancelPendingPayoutForItem({ item, session, reason: 'result_changed_to_lost' });
      item.payoutAppliedAmount = 0;
      item.payoutLedgerGroupId = '';
      item.payoutStatus = 'none';
      item.pendingPayoutId = null;
      item.payoutUpdatedAt = payoutUpdatedAt;
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

  await saveModifiedCustomers(customerMap, session);

  const legacyGovernmentResult = await LotteryResult.findOne({ roundDate: round.code }).session(session);
  if (legacyGovernmentResult) {
    legacyGovernmentResult.isCalculated = true;
    await legacyGovernmentResult.save({ session });
  }

  return {
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
    pendingPayoutCount,
    pendingPayoutTotal,
    releasedStakeTotal,
    payoutGroupId: payoutGroupIds[0] || ''
  };
};

const reverseRoundSettlement = async (roundId, { session }) => {
  const round = await loadRoundForSettlement(roundId, session);
  const { items, customerMap } = await loadRoundItemsWithCustomers(round._id, session);
  const payoutUpdatedAt = new Date();

  let resetItemCount = 0;
  let reversedPayoutTotal = 0;
  let cancelledPendingPayoutCount = 0;
  let reversalEntryCount = 0;

  for (const item of items) {
    const appliedAmount = toMoney(item.payoutAppliedAmount);
    const shouldReset =
      item.isLocked ||
      item.result !== 'pending' ||
      toMoney(item.wonAmount) !== 0 ||
      appliedAmount !== 0 ||
      item.payoutStatus === 'pending';

    if (!shouldReset) {
      continue;
    }

    if (item.payoutStatus === 'pending') {
      const cancelled = await cancelPendingPayoutForItem({ item, session });
      if (cancelled) cancelledPendingPayoutCount++;
    }

    if (appliedAmount !== 0) {
      const reversal = await reversePaidPayoutToAgent({ item, round, amount: appliedAmount, session });
      if (reversal) {
        reversalEntryCount += 2;
        reversedPayoutTotal += appliedAmount;
      }
      await cancelLinkedPaidPayout({ item, session });
    }

    if (item.isLocked) {
      await reverseAgentStakeReleaseToHeld({ item, round, session });
      reversalEntryCount++;
    }

    item.result = 'pending';
    item.wonAmount = 0;
    item.payoutAppliedAmount = 0;
    item.payoutLedgerGroupId = '';
    item.payoutStatus = 'none';
    item.pendingPayoutId = null;
    item.payoutUpdatedAt = payoutUpdatedAt;
    item.isLocked = false;

    await item.save({ session });
    resetItemCount++;
  }

  await saveModifiedCustomers(customerMap, session);

  return {
    roundId: round._id.toString(),
    roundCode: round.code,
    totalItems: items.length,
    resetItemCount,
    reversedPayoutTotal,
    cancelledPendingPayoutCount,
    reversalEntryCount,
    reversalGroupId: ''
  };
};

const reconcileRoundSettlementById = async (roundId) => {
  const round = await DrawRound.findById(roundId).select('code lotteryTypeId status resultPublishedAt');
  if (!round) {
    throw new Error('Round not found');
  }

  const record = await ResultRecord.findOne({ drawRoundId: round._id, isPublished: true }).lean();
  const items = await BetItem.find({ drawRoundId: round._id, status: 'submitted' }).lean();
  const ledgerEntries = await CreditLedgerEntry.find({
    entryType: 'settlement',
    reasonCode: { $in: ['member_payout_credit', 'bet_result_payout', 'bet_result_rollback'] },
    'metadata.roundId': round._id.toString()
  }).lean();
  const pendingPayouts = await PendingPayout.find({
    roundId: round._id,
    status: 'pending'
  }).lean();
  const pendingPayoutByItem = new Map(
    pendingPayouts.map((payout) => [toIdString(payout.betItemId), payout])
  );

  const payoutNetByItem = new Map();
  for (const entry of ledgerEntries) {
    const betItemId = String(entry.metadata?.betItemId || '');
    if (!betItemId) continue;
    const directionSign = entry.direction === 'credit' ? 1 : -1;
    payoutNetByItem.set(
      betItemId,
      toMoney(payoutNetByItem.get(betItemId)) + directionSign * toMoney(entry.amount)
    );
  }

  if (!record) {
    const unsettledItems = items.filter((item) => item.isLocked || item.result !== 'pending' || toMoney(item.payoutAppliedAmount) !== 0);
    return {
      roundId: round._id.toString(),
      roundCode: round.code,
      hasPublishedResult: false,
      totalItems: items.length,
      matchedItems: items.length - unsettledItems.length,
      mismatchedItems: unsettledItems.length,
      mismatches: unsettledItems.slice(0, 20).map((item) => ({
        betItemId: item._id.toString(),
        betType: item.betType,
        number: item.number,
        reasons: ['unexpected-settlement-without-published-result']
      }))
    };
  }

  const normalized = normalizeResultPayload(record);
  const mismatches = [];
  let expectedWonCount = 0;
  let expectedLostCount = 0;
  let expectedPayoutTotal = 0;
  let appliedPayoutTotal = 0;

  for (const item of items) {
    const expectedWonAmount = calculateItemWonAmount(item, normalized);
    const isWon = expectedWonAmount > 0;
    const expectedResult = isWon ? 'won' : 'lost';
    const appliedPayoutAmount = toMoney(item.payoutAppliedAmount);
    const ledgerNetAmount = toMoney(payoutNetByItem.get(item._id.toString()));
    const pendingPayout = pendingPayoutByItem.get(item._id.toString());
    const expectedAppliedPayoutAmount = pendingPayout ? 0 : expectedWonAmount;
    const reasons = [];

    if (item.result !== expectedResult) reasons.push('result-mismatch');
    if (toMoney(item.wonAmount) !== expectedWonAmount) reasons.push('won-amount-mismatch');
    if (appliedPayoutAmount !== expectedAppliedPayoutAmount) reasons.push('payout-applied-mismatch');
    if (pendingPayout && toMoney(pendingPayout.payoutAmount) !== expectedWonAmount) reasons.push('pending-payout-amount-mismatch');
    if (!pendingPayout && item.payoutStatus === 'pending') reasons.push('pending-payout-missing');
    if (item.isLocked !== true) reasons.push('lock-state-mismatch');
    if (ledgerNetAmount !== appliedPayoutAmount) reasons.push('ledger-net-mismatch');

    if (reasons.length) {
      mismatches.push({
        betItemId: item._id.toString(),
        betType: item.betType,
        number: item.number,
        reasons,
        current: {
          result: item.result,
          wonAmount: toMoney(item.wonAmount),
          payoutAppliedAmount: appliedPayoutAmount,
          payoutStatus: item.payoutStatus || 'none',
          pendingPayoutAmount: pendingPayout ? toMoney(pendingPayout.payoutAmount) : 0,
          isLocked: Boolean(item.isLocked),
          ledgerNetAmount
        },
        expected: {
          result: expectedResult,
          wonAmount: expectedWonAmount,
          payoutAppliedAmount: expectedAppliedPayoutAmount,
          isLocked: true
        }
      });
    }

    if (isWon) {
      expectedWonCount++;
      expectedPayoutTotal += expectedWonAmount;
    } else {
      expectedLostCount++;
    }
    appliedPayoutTotal += appliedPayoutAmount;
  }

  return {
    roundId: round._id.toString(),
    roundCode: round.code,
    hasPublishedResult: true,
    resultRecordId: record._id.toString(),
    totalItems: items.length,
    expectedWonCount,
    expectedLostCount,
    expectedPayoutTotal,
    appliedPayoutTotal,
    ledgerEntryCount: ledgerEntries.length,
    pendingPayoutCount: pendingPayouts.length,
    pendingPayoutTotal: pendingPayouts.reduce((sum, payout) => sum + toMoney(payout.payoutAmount), 0),
    matchedItems: items.length - mismatches.length,
    mismatchedItems: mismatches.length,
    mismatches: mismatches.slice(0, 20)
  };
};

const reverseRoundSettlementById = async (roundId) => {
  const session = await mongoose.startSession();

  try {
    let summary = null;
    await session.withTransaction(async () => {
      summary = await reverseRoundSettlement(roundId, { session });
    });
    return summary;
  } finally {
    await session.endSession();
  }
};

const rerunRoundSettlementById = async (roundId) => {
  const session = await mongoose.startSession();

  try {
    let summary = null;
    await session.withTransaction(async () => {
      const reverseSummary = await reverseRoundSettlement(roundId, { session });
      const settlementSummary = await applyRoundSettlement(roundId, { force: true, session });
      summary = {
        roundId: settlementSummary.roundId,
        roundCode: settlementSummary.roundCode,
        reverse: reverseSummary,
        settlement: settlementSummary
      };
    });
    return summary;
  } finally {
    await session.endSession();
  }
};

const settleRoundById = async (roundId, { force = false } = {}) => {
  const session = await mongoose.startSession();

  try {
    let summary = null;

    await session.withTransaction(async () => {
      summary = await applyRoundSettlement(roundId, { force, session });
    });

    return summary;
  } finally {
    await session.endSession();
  }
};

const settleUnsettledPublishedRounds = async ({ limit = 100 } = {}) => {
  const pendingRoundIds = await BetItem.distinct('drawRoundId', {
    status: 'submitted',
    isLocked: false
  });

  const normalizedLimit = Math.max(1, Number(limit) || 100);
  const records = await ResultRecord.find({
    drawRoundId: { $in: pendingRoundIds },
    isPublished: true
  })
    .select('drawRoundId lotteryTypeId updatedAt')
    .sort({ updatedAt: -1 })
    .limit(normalizedLimit)
    .lean();

  const summaries = [];
  for (const record of records) {
    const pendingItemCount = await BetItem.countDocuments({
      drawRoundId: record.drawRoundId,
      status: 'submitted',
      isLocked: false
    });

    if (!pendingItemCount) {
      continue;
    }

    const [round, lottery] = await Promise.all([
      DrawRound.findById(record.drawRoundId).select('code').lean(),
      LotteryType.findById(record.lotteryTypeId).select('code name').lean()
    ]);
    const settlement = await settleRoundById(record.drawRoundId, { force: false });

    summaries.push({
      lotteryCode: lottery?.code || '',
      roundCode: round?.code || settlement.roundCode,
      pendingItemCount,
      settlement
    });
  }

  return {
    checkedRounds: records.length,
    settledRounds: summaries.filter((item) => Number(item.settlement?.totalItems || 0) > 0).length,
    totalItems: summaries.reduce((sum, item) => sum + Number(item.settlement?.totalItems || 0), 0),
    totalWon: summaries.reduce((sum, item) => sum + Number(item.settlement?.totalWon || 0), 0),
    payoutEntryCount: summaries.reduce((sum, item) => sum + Number(item.settlement?.payoutEntryCount || 0), 0),
    payoutNetDelta: summaries.reduce((sum, item) => sum + Number(item.settlement?.payoutNetDelta || 0), 0),
    summaries
  };
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
  resolveRoundForResultCode,
  calculateItemWonAmount,
  checkItemResult,
  findRoundByCode,
  getLaoSetPrizeMatch,
  normalizeResultPayload,
  validatePublishedResultPayload,
  upsertRoundResult,
  syncLegacyThaiGovernmentResult,
  reconcileRoundSettlementById,
  reverseRoundSettlementById,
  rerunRoundSettlementById,
  settleRoundById,
  settleUnsettledPublishedRounds,
  settleRoundByCode,
  getRoundResult
};
