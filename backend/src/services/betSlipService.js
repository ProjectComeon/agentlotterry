const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const User = require('../models/User');
const { getRoundStatus } = require('./catalogService');
const { getMemberLotteryAccess } = require('./memberManagementService');
const { normalizeLotteryCode } = require('../utils/lotteryCode');
const { getPermutations } = require('../utils/numberHelpers');

const MAX_SLIP_ITEMS = 500;
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const DIGIT_LENGTHS = {
  '3top': 3,
  '3tod': 3,
  '2top': 2,
  '2bottom': 2,
  'run_top': 1,
  'run_bottom': 1
};

const makeSlipNumber = () => {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SLP-${stamp}-${suffix}`;
};

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const buildDoubleSet = (digits) => {
  if (digits === 1) {
    return Array.from({ length: 10 }, (_, index) => String(index));
  }

  if (digits === 2) {
    return Array.from({ length: 10 }, (_, index) => `${index}${index}`);
  }

  const numbers = new Set();
  for (let repeatedDigit = 0; repeatedDigit <= 9; repeatedDigit++) {
    for (let oddDigit = 0; oddDigit <= 9; oddDigit++) {
      if (oddDigit === repeatedDigit) continue;
      numbers.add(`${repeatedDigit}${repeatedDigit}${oddDigit}`);
      numbers.add(`${repeatedDigit}${oddDigit}${repeatedDigit}`);
      numbers.add(`${oddDigit}${repeatedDigit}${repeatedDigit}`);
    }
  }
  return [...numbers].sort();
};

const expandNumbers = (number, betType, reverse) => {
  if (!reverse) return [number];

  if (betType === '2top' || betType === '2bottom') {
    return [...new Set([number, number.split('').reverse().join('')])];
  }

  if (betType === '3top' || betType === '3tod') {
    return getPermutations(number);
  }

  return [number];
};

const parseRawLines = (rawInput) => {
  return String(rawInput || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseLine = (line) => {
  const match = line.match(/^(\d+)(?:\s*(?:[=/:,\-]|\s)\s*(\d+(?:\.\d+)?))?$/);
  if (!match) {
    throw new Error(`Invalid fast bet line: ${line}`);
  }

  return {
    number: match[1],
    amount: match[2] ? Number(match[2]) : null
  };
};

const combineEntries = (entries, payRate) => {
  const grouped = new Map();

  entries.forEach((entry) => {
    const key = `${entry.betType}:${entry.number}`;
    const current = grouped.get(key);
    if (current) {
      current.amount += entry.amount;
      current.potentialPayout = current.amount * payRate;
      current.sourceFlags.fromReverse = current.sourceFlags.fromReverse || entry.sourceFlags.fromReverse;
      current.sourceFlags.fromDoubleSet = current.sourceFlags.fromDoubleSet || entry.sourceFlags.fromDoubleSet;
      return;
    }

    grouped.set(key, {
      ...entry,
      payRate,
      potentialPayout: entry.amount * payRate
    });
  });

  return [...grouped.values()];
};

const buildExposureMap = (rows) =>
  rows.reduce((acc, row) => {
    acc[`${row._id.betType}:${row._id.number}`] = row.totalAmount || 0;
    return acc;
  }, {});

const fetchExposureMap = async ({ customerId = '', agentId = '', lotteryTypeId, drawRoundId, entries }) => {
  const match = {
    lotteryTypeId: new mongoose.Types.ObjectId(lotteryTypeId),
    drawRoundId: new mongoose.Types.ObjectId(drawRoundId),
    status: 'submitted',
    number: { $in: [...new Set(entries.map((entry) => entry.number))] },
    betType: { $in: [...new Set(entries.map((entry) => entry.betType))] }
  };

  if (customerId) {
    match.customerId = new mongoose.Types.ObjectId(customerId);
  }

  if (agentId) {
    match.agentId = new mongoose.Types.ObjectId(agentId);
  }

  const rows = await BetItem.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          betType: '$betType',
          number: '$number'
        },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return buildExposureMap(rows);
};

const buildPreviewEntries = ({
  betType,
  defaultAmount,
  rawInput,
  reverse = false,
  includeDoubleSet = false,
  payRate
}) => {
  const digits = DIGIT_LENGTHS[betType];
  if (!digits) {
    throw new Error('Unsupported bet type');
  }

  const defaultStake = Number(defaultAmount || 0);
  const lines = parseRawLines(rawInput);
  const rawEntries = lines.map(parseLine);

  if (!rawEntries.length && !includeDoubleSet) {
    throw new Error('Please enter at least one betting line');
  }

  const baseEntries = [];

  rawEntries.forEach((entry) => {
    const amount = entry.amount ?? defaultStake;
    const number = normalizeDigits(entry.number);

    if (!amount || amount < 1) {
      throw new Error(`Invalid stake for line ${entry.number}`);
    }

    if (number.length !== digits) {
      throw new Error(`Bet type ${betType} requires exactly ${digits} digits`);
    }

    expandNumbers(number, betType, reverse).forEach((expandedNumber) => {
      baseEntries.push({
        betType,
        number: expandedNumber,
        amount,
        sourceFlags: {
          fromReverse: reverse && expandedNumber !== number,
          fromDoubleSet: false
        }
      });
    });
  });

  if (includeDoubleSet) {
    if (!defaultStake || defaultStake < 1) {
      throw new Error('Default amount is required when using the double-number helper');
    }

    buildDoubleSet(digits).forEach((number) => {
      baseEntries.push({
        betType,
        number,
        amount: defaultStake,
        sourceFlags: {
          fromReverse: false,
          fromDoubleSet: true
        }
      });
    });
  }

  const combined = combineEntries(baseEntries, payRate);
  if (combined.length > MAX_SLIP_ITEMS) {
    throw new Error(`A single slip supports up to ${MAX_SLIP_ITEMS} items`);
  }

  return combined;
};

const validateEntriesAgainstMemberConfig = (entries, memberConfig) => {
  if (!memberConfig) {
    return;
  }

  const minimumBet = Number(memberConfig.minimumBet || 0);
  const maximumBet = Number(memberConfig.maximumBet || 0);
  const maximumPerNumber = Number(memberConfig.maximumPerNumber || 0);

  if (minimumBet > 0) {
    const invalidMinimum = entries.find((entry) => entry.amount < minimumBet);
    if (invalidMinimum) {
      throw new Error(`Minimum bet for this member is ${minimumBet}`);
    }
  }

  if (maximumBet > 0) {
    const invalidMaximum = entries.find((entry) => entry.amount > maximumBet);
    if (invalidMaximum) {
      throw new Error(`Maximum bet for this member is ${maximumBet}`);
    }
  }

  if (maximumPerNumber > 0) {
    const totalsByNumber = entries.reduce((acc, entry) => {
      acc[entry.number] = (acc[entry.number] || 0) + entry.amount;
      return acc;
    }, {});

    const exceededEntry = Object.entries(totalsByNumber).find(([, amount]) => amount > maximumPerNumber);
    if (exceededEntry) {
      throw new Error(`Number ${exceededEntry[0]} exceeds the limit of ${maximumPerNumber}`);
    }
  }
};

const validateEntriesAgainstRiskRules = async ({ entries, context, customerId }) => {
  const blockedNumbers = new Set(
    (context.memberConfig?.blockedNumbers || [])
      .map((item) => normalizeDigits(item))
      .filter(Boolean)
  );

  const blockedEntry = entries.find((entry) => blockedNumbers.has(entry.number));
  if (blockedEntry) {
    throw new Error(`Number ${blockedEntry.number} is blocked for this member`);
  }

  const groupedIncoming = entries.reduce((acc, entry) => {
    const key = `${entry.betType}:${entry.number}`;
    acc[key] = (acc[key] || 0) + entry.amount;
    return acc;
  }, {});

  const maximumPerNumber = Number(context.memberConfig?.maximumPerNumber || 0);
  if (maximumPerNumber > 0) {
    const customerExposure = await fetchExposureMap({
      customerId,
      lotteryTypeId: context.lottery._id.toString(),
      drawRoundId: context.round._id.toString(),
      entries
    });

    const overflow = Object.entries(groupedIncoming).find(([key, amount]) => (customerExposure[key] || 0) + amount > maximumPerNumber);
    if (overflow) {
      const [, number] = overflow[0].split(':');
      throw new Error(`Number ${number} exceeds the member limit of ${maximumPerNumber}`);
    }
  }

  const keepMode = context.memberConfig?.keepMode || 'off';
  const keepCapAmount = Number(context.memberConfig?.keepCapAmount || 0);
  if (keepMode === 'cap' && keepCapAmount > 0 && context.member?.agentId) {
    const agentExposure = await fetchExposureMap({
      agentId: context.member.agentId.toString(),
      lotteryTypeId: context.lottery._id.toString(),
      drawRoundId: context.round._id.toString(),
      entries
    });

    const overflow = Object.entries(groupedIncoming).find(([key, amount]) => (agentExposure[key] || 0) + amount > keepCapAmount);
    if (overflow) {
      const [, number] = overflow[0].split(':');
      throw new Error(`Number ${number} exceeds the keep cap of ${keepCapAmount}`);
    }
  }
};

const loadSlipContext = async ({ customerId = '', lotteryId, roundId, rateProfileId, betType }) => {
  if (!lotteryId || !roundId) {
    throw new Error('lotteryId and roundId are required');
  }

  let lottery = await LotteryType.findById(lotteryId).populate('leagueId', 'code name');
  let memberConfig = null;
  let member = null;
  let enforcedRateProfileId = rateProfileId || '';

  if (customerId) {
    const access = await getMemberLotteryAccess({ customerId, lotteryId, betType, rateProfileId });
    member = access.member;
    lottery = access.lottery;
    memberConfig = access.config;
    enforcedRateProfileId = access.rateProfileId || enforcedRateProfileId;
  } else if (!lottery || !lottery.isActive) {
    throw new Error('Selected lottery is not available');
  }

  if (!lottery.supportedBetTypes.includes(betType)) {
    throw new Error('Selected bet type is not supported by this lottery');
  }

  const round = await DrawRound.findById(roundId);
  if (!round || round.lotteryTypeId.toString() !== lottery._id.toString()) {
    throw new Error('Selected round was not found for this lottery');
  }

  let rateProfile = null;
  const allowedRateIds = (lottery.rateProfileIds || []).map(toIdString).filter(Boolean);
  const resolvedRateProfileId =
    enforcedRateProfileId ||
    toIdString(lottery.defaultRateProfileId) ||
    null;

  if (resolvedRateProfileId) {
    if (!allowedRateIds.includes(resolvedRateProfileId)) {
      throw new Error('Selected rate profile is not allowed for this lottery');
    }

    rateProfile = await RateProfile.findById(resolvedRateProfileId);
    if (!rateProfile || !rateProfile.isActive) {
      throw new Error('Selected rate profile is not available');
    }
  }

  const customPayRate = memberConfig?.useCustomRates ? Number(memberConfig.customRates?.[betType] || 0) : 0;
  const payRate = customPayRate || rateProfile?.rates?.[betType] || 0;
  if (!payRate) {
    throw new Error('No pay rate configured for this bet type');
  }

  return {
    lottery,
    member,
    round,
    rateProfile,
    payRate,
    roundStatus: getRoundStatus(round),
    memberConfig
  };
};

const buildSlipResponse = async (slips) => {
  const slipList = Array.isArray(slips) ? slips : [slips];
  if (!slipList.length) {
    return Array.isArray(slips) ? [] : null;
  }

  const slipIds = slipList.map((slip) => slip._id);
  const [items, itemSummaries] = await Promise.all([
    BetItem.find({ slipId: { $in: slipIds } }).sort({ sequence: 1, createdAt: 1 }),
    BetItem.aggregate([
      { $match: { slipId: { $in: slipIds } } },
      {
        $group: {
          _id: '$slipId',
          totalAmount: { $sum: '$amount' },
          totalWon: { $sum: '$wonAmount' },
          wonCount: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
          pendingCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'submitted'] },
                    { $eq: ['$result', 'pending'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  const itemsBySlipId = items.reduce((acc, item) => {
    const key = item.slipId.toString();
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  const itemSummaryMap = itemSummaries.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  const mapped = slipList.map((slip) => {
    const slipId = slip._id.toString();
    const slipItems = itemsBySlipId[slipId] || [];
    const summary = itemSummaryMap[slipId] || null;
    const canCancel = slip.status === 'submitted' && new Date() <= new Date(slip.closeAt) && (summary?.pendingCount ?? slip.itemCount) > 0;

    return {
      id: slipId,
      slipNumber: slip.slipNumber,
      status: slip.status,
      sourceType: slip.sourceType,
      memo: slip.memo,
      lotteryCode: slip.lotteryCode,
      lotteryName: slip.lotteryName,
      roundCode: slip.roundCode,
      roundTitle: slip.roundTitle,
      rateProfileName: slip.rateProfileName,
      itemCount: slip.itemCount,
      totalAmount: slip.totalAmount,
      potentialPayout: slip.potentialPayout,
      submittedAt: slip.submittedAt,
      cancelledAt: slip.cancelledAt,
      cancelledReason: slip.cancelledReason,
      openAt: slip.openAt,
      closeAt: slip.closeAt,
      drawAt: slip.drawAt,
      previewNumbers: slipItems.slice(0, 8).map((item) => item.number),
      summary: {
        totalAmount: summary?.totalAmount ?? slip.totalAmount,
        totalWon: summary?.totalWon ?? 0,
        wonCount: summary?.wonCount ?? 0,
        lostCount: summary?.lostCount ?? 0,
        pendingCount: summary?.pendingCount ?? (slip.status === 'submitted' ? slip.itemCount : 0)
      },
      items: slipItems.map((item) => ({
        id: item._id.toString(),
        sequence: item.sequence,
        betType: item.betType,
        number: item.number,
        amount: item.amount,
        payRate: item.payRate,
        potentialPayout: item.potentialPayout,
        status: item.status,
        result: item.result,
        wonAmount: item.wonAmount,
        isLocked: item.isLocked,
        sourceFlags: item.sourceFlags
      })),
      canCancel,
      createdAt: slip.createdAt,
      updatedAt: slip.updatedAt
    };
  });

  return Array.isArray(slips) ? mapped : mapped[0];
};

const previewSlip = async ({
  customerId = '',
  lotteryId,
  roundId,
  rateProfileId,
  betType,
  defaultAmount,
  rawInput,
  reverse = false,
  includeDoubleSet = false
}) => {
  const context = await loadSlipContext({ customerId, lotteryId, roundId, rateProfileId, betType });
  const entries = buildPreviewEntries({
    betType,
    defaultAmount,
    rawInput,
    reverse,
    includeDoubleSet,
    payRate: context.payRate
  });
  validateEntriesAgainstMemberConfig(entries, context.memberConfig);
  await validateEntriesAgainstRiskRules({ entries, context, customerId });

  return {
    lottery: {
      id: context.lottery._id.toString(),
      code: context.lottery.code,
      name: context.lottery.name,
      leagueCode: context.lottery.leagueId?.code || ''
    },
    round: {
      id: context.round._id.toString(),
      code: context.round.code,
      title: context.round.title,
      openAt: context.round.openAt,
      closeAt: context.round.closeAt,
      drawAt: context.round.drawAt
    },
    rateProfile: context.rateProfile ? {
      id: context.rateProfile._id.toString(),
      name: context.rateProfile.name
    } : null,
    roundStatus: context.roundStatus,
    summary: {
      itemCount: entries.length,
      totalAmount: entries.reduce((sum, item) => sum + item.amount, 0),
      potentialPayout: entries.reduce((sum, item) => sum + item.potentialPayout, 0)
    },
    memberLimits: context.memberConfig ? {
      minimumBet: context.memberConfig.minimumBet,
      maximumBet: context.memberConfig.maximumBet,
      maximumPerNumber: context.memberConfig.maximumPerNumber,
      keepMode: context.memberConfig.keepMode,
      keepCapAmount: context.memberConfig.keepCapAmount,
      blockedNumbers: context.memberConfig.blockedNumbers || []
    } : null,
    items: entries
  };
};

const createSlip = async ({
  customerId,
  lotteryId,
  roundId,
  rateProfileId,
  betType,
  defaultAmount,
  rawInput,
  reverse = false,
  includeDoubleSet = false,
  memo = '',
  action = 'submit'
}) => {
  const customer = await User.findById(customerId);
  if (!customer || !customer.agentId) {
    throw new Error('Customer has no assigned agent');
  }

  const preview = await previewSlip({
    customerId,
    lotteryId,
    roundId,
    rateProfileId,
    betType,
    defaultAmount,
    rawInput,
    reverse,
    includeDoubleSet
  });

  if (action === 'submit' && preview.roundStatus.status !== 'open') {
    throw new Error('This round is not open for betting');
  }

  const slip = await BetSlip.create({
    customerId,
    agentId: customer.agentId,
    lotteryTypeId: lotteryId,
    drawRoundId: roundId,
    rateProfileId: preview.rateProfile?.id || null,
    slipNumber: makeSlipNumber(),
    lotteryCode: preview.lottery.code,
    lotteryName: preview.lottery.name,
    roundCode: preview.round.code,
    roundTitle: preview.round.title,
    rateProfileName: preview.rateProfile?.name || '',
    openAt: preview.round.openAt,
    closeAt: preview.round.closeAt,
    drawAt: preview.round.drawAt,
    status: action === 'draft' ? 'draft' : 'submitted',
    memo,
    itemCount: preview.summary.itemCount,
    totalAmount: preview.summary.totalAmount,
    potentialPayout: preview.summary.potentialPayout,
    submittedAt: action === 'submit' ? new Date() : null
  });

  const createdItems = await BetItem.insertMany(preview.items.map((item, index) => ({
    slipId: slip._id,
    customerId,
    agentId: customer.agentId,
    lotteryTypeId: lotteryId,
    drawRoundId: roundId,
    rateProfileId: preview.rateProfile?.id || null,
    sequence: index + 1,
    betType: item.betType,
    number: item.number,
    amount: item.amount,
    payRate: item.payRate,
    potentialPayout: item.potentialPayout,
    status: action === 'draft' ? 'draft' : 'submitted',
    sourceFlags: item.sourceFlags
  })));

  return buildSlipResponse(slip);
};

const listSlips = async ({ customerId, status }) => {
  const filter = { customerId };
  if (status) {
    filter.status = status;
  }

  const slips = await BetSlip.find(filter).sort({ createdAt: -1 }).limit(100);
  return buildSlipResponse(slips);
};

const getSlipDetail = async ({ customerId, slipId }) => {
  const slip = await BetSlip.findOne({ _id: slipId, customerId });
  if (!slip) {
    throw new Error('Slip not found');
  }

  return buildSlipResponse(slip);
};

const listBetItems = async ({ customerId, slipId, status }) => {
  const filter = { customerId };
  if (slipId) filter.slipId = slipId;
  if (status) filter.status = status;

  const items = await BetItem.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('slipId', 'slipNumber status lotteryName roundCode roundTitle closeAt submittedAt');

  return items.map((item) => {
    return {
      id: item._id.toString(),
      slipId: item.slipId?._id?.toString() || item.slipId?.toString(),
      slipNumber: item.slipId?.slipNumber || '',
      slipStatus: item.slipId?.status || item.status,
      lotteryName: item.slipId?.lotteryName || '',
      roundCode: item.slipId?.roundCode || '',
      roundTitle: item.slipId?.roundTitle || '',
      submittedAt: item.slipId?.submittedAt || null,
      betType: item.betType,
      number: item.number,
      amount: item.amount,
      payRate: item.payRate,
      potentialPayout: item.potentialPayout,
      status: item.status,
      result: item.result || 'pending',
      wonAmount: item.wonAmount || 0,
      isLocked: item.isLocked || false
    };
  });
};

const cancelSlip = async ({ customerId, slipId }) => {
  const slip = await BetSlip.findOne({ _id: slipId, customerId });
  if (!slip) {
    throw new Error('Slip not found');
  }

  if (slip.status !== 'submitted') {
    throw new Error('Only submitted slips can be cancelled');
  }

  if (new Date() > new Date(slip.closeAt)) {
    throw new Error('This slip can no longer be cancelled');
  }

  const items = await BetItem.find({ slipId: slip._id }).select('result isLocked');
  if (items.some((item) => item.isLocked || item.result !== 'pending')) {
    throw new Error('This slip already has resolved items and cannot be cancelled');
  }

  await BetItem.updateMany({ slipId: slip._id }, { $set: { status: 'cancelled' } });

  slip.status = 'cancelled';
  slip.cancelledAt = new Date();
  slip.cancelledReason = 'member-request';
  await slip.save();

  return buildSlipResponse(slip);
};

const getMemberSummary = async ({
  customerId,
  lotteryId,
  marketId,
  roundCode,
  roundDate
}) => {
  const slipFilter = {
    customerId,
    status: 'submitted'
  };

  if (lotteryId) {
    slipFilter.lotteryTypeId = lotteryId;
  }

  const normalizedLotteryCode = normalizeLotteryCode(marketId);
  if (normalizedLotteryCode) {
    slipFilter.lotteryCode = normalizedLotteryCode;
  }

  const resolvedRoundCode = roundCode || roundDate || '';
  if (resolvedRoundCode) {
    slipFilter.roundCode = resolvedRoundCode;
  }

  const slips = await BetSlip.find(slipFilter).sort({ roundCode: -1, createdAt: -1 });
  if (!slips.length) {
    return {
      rounds: [],
      overall: {
        totalAmount: 0,
        totalWon: 0,
        netResult: 0,
        totalBets: 0
      }
    };
  }

  const slipMap = slips.reduce((acc, slip) => {
    acc[slip._id.toString()] = slip;
    return acc;
  }, {});

  const items = await BetItem.find({
    slipId: { $in: slips.map((slip) => slip._id) },
    status: 'submitted'
  }).select('slipId amount wonAmount result');

  const roundMap = new Map();
  const overall = {
    totalAmount: 0,
    totalWon: 0,
    totalBets: 0
  };

  items.forEach((item) => {
    const slip = slipMap[item.slipId.toString()];
    if (!slip) return;

    const key = `${slip.roundCode}:${slip.lotteryCode}`;
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        roundDate: slip.roundCode,
        roundCode: slip.roundCode,
        marketId: slip.lotteryCode,
        lotteryCode: slip.lotteryCode,
        marketName: slip.lotteryName,
        lotteryName: slip.lotteryName,
        totalAmount: 0,
        totalWon: 0,
        betCount: 0,
        wonCount: 0,
        lostCount: 0,
        pendingCount: 0
      });
    }

    const summary = roundMap.get(key);
    summary.totalAmount += item.amount;
    summary.totalWon += item.wonAmount || 0;
    summary.betCount += 1;

    if (item.result === 'won') {
      summary.wonCount += 1;
    } else if (item.result === 'lost') {
      summary.lostCount += 1;
    } else {
      summary.pendingCount += 1;
    }

    overall.totalAmount += item.amount;
    overall.totalWon += item.wonAmount || 0;
    overall.totalBets += 1;
  });

  const rounds = [...roundMap.values()]
    .map((entry) => ({
      ...entry,
      netResult: entry.totalWon - entry.totalAmount
    }))
    .sort((left, right) => {
      if (left.roundCode === right.roundCode) {
        return left.marketName.localeCompare(right.marketName);
      }
      return right.roundCode.localeCompare(left.roundCode);
    });

  return {
    rounds,
    overall: {
      totalAmount: overall.totalAmount,
      totalWon: overall.totalWon,
      netResult: overall.totalWon - overall.totalAmount,
      totalBets: overall.totalBets
    }
  };
};

module.exports = {
  previewSlip,
  createSlip,
  listSlips,
  getSlipDetail,
  listBetItems,
  cancelSlip,
  getMemberSummary
};
