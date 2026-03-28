const BetItem = require('../models/BetItem');
const DrawRound = require('../models/DrawRound');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const ResultRecord = require('../models/ResultRecord');
const { createBangkokDate } = require('../utils/bangkokTime');
const { getPermutations } = require('../utils/numberHelpers');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

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
  const threeTop = normalizeDigits(payload.threeTop || (firstPrize ? firstPrize.slice(-3) : ''));
  const twoTop = normalizeDigits(payload.twoTop || (firstPrize ? firstPrize.slice(-2) : ''));
  const twoBottom = normalizeDigits(payload.twoBottom);
  const threeBottom = normalizeDigits(payload.threeBottom);
  const runTop = (Array.isArray(payload.runTop) ? payload.runTop : String(payload.runTop || '').split(','))
    .map(normalizeDigits)
    .filter(Boolean);
  const runBottom = (Array.isArray(payload.runBottom) ? payload.runBottom : String(payload.runBottom || '').split(','))
    .map(normalizeDigits)
    .filter(Boolean);

  return {
    headline: normalizeDigits(payload.headline || firstPrize || twoBottom || threeTop),
    firstPrize,
    threeTop,
    twoTop,
    twoBottom,
    threeBottom,
    runTop: runTop.length ? runTop : [...new Set(threeTop.split('').filter(Boolean))],
    runBottom: runBottom.length ? runBottom : [...new Set(twoBottom.split('').filter(Boolean))]
  };
};

const checkItemResult = (item, normalizedResult) => {
  const number = String(item.number || '').trim();

  switch (item.betType) {
    case '3top':
      return number === normalizedResult.threeTop;
    case '3tod':
      return getPermutations(normalizedResult.threeTop).includes(number);
    case '2top':
      return number === normalizedResult.twoTop;
    case '2bottom':
      return number === normalizedResult.twoBottom;
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
  if (!normalized.firstPrize && !normalized.twoBottom) {
    throw new Error('Result payload is incomplete');
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
        threeBottom: normalized.threeBottom,
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
      threeBottom: legacyResult.threeBotList?.[0] || '',
      runTop: legacyResult.runTop || [],
      runBottom: legacyResult.runBottom || []
    }
  });
};

const settleRoundById = async (roundId, { force = false } = {}) => {
  const round = await DrawRound.findById(roundId);
  if (!round) {
    throw new Error('Round not found');
  }

  const record = await ResultRecord.findOne({ drawRoundId: round._id, isPublished: true });
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

  const items = await BetItem.find(itemFilter);

  let totalWon = 0;
  let totalLost = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const item of items) {
    const isWon = checkItemResult(item, normalized);
    item.result = isWon ? 'won' : 'lost';
    item.wonAmount = isWon ? item.amount * item.payRate : 0;
    item.isLocked = true;
    await item.save();

    if (isWon) {
      totalWon += item.wonAmount;
      wonCount++;
    } else {
      totalLost += item.amount;
      lostCount++;
    }
  }

  const legacyGovernmentResult = await LotteryResult.findOne({ roundDate: round.code });
  if (legacyGovernmentResult) {
    legacyGovernmentResult.isCalculated = true;
    await legacyGovernmentResult.save();
  }

  return {
    roundId: round._id.toString(),
    roundCode: round.code,
    totalItems: items.length,
    wonCount,
    lostCount,
    totalWon,
    totalLost,
    netProfit: totalLost - totalWon
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
    threeBottom: record.threeBottom,
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
  findRoundByCode,
  normalizeResultPayload,
  upsertRoundResult,
  syncLegacyThaiGovernmentResult,
  settleRoundById,
  settleRoundByCode,
  getRoundResult
};
