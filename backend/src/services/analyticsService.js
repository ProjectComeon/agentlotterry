const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const User = require('../models/User');
const { Types } = require('mongoose');
const { normalizeLotteryCode } = require('../utils/lotteryCode');
const { buildPaginatedResult } = require('../utils/pagination');
const {
  addBetTotals,
  getArchivedBetTotals,
  getArchivedTotalsGroupedByField,
  mergeGroupedTotals
} = require('./retentionArchiveService');

const DEFAULT_ANALYTICS_READ_CACHE_TTL_MS = 5000;
const analyticsReadCacheTtlMs = Math.max(
  0,
  Number(process.env.ANALYTICS_READ_CACHE_TTL_MS || DEFAULT_ANALYTICS_READ_CACHE_TTL_MS)
);
const analyticsReadCache = new Map();
const analyticsReadInFlight = new Map();

const toObjectId = (value) => (Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value);

const buildAnalyticsReadCacheKey = (scope, params = {}) =>
  `${scope}:${JSON.stringify(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  )}`;

const loadWithAnalyticsReadCache = async (key, loader) => {
  if (!analyticsReadCacheTtlMs) {
    return loader();
  }

  const now = Date.now();
  const cached = analyticsReadCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (analyticsReadInFlight.has(key)) {
    return analyticsReadInFlight.get(key);
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      analyticsReadCache.set(key, {
        value,
        expiresAt: Date.now() + analyticsReadCacheTtlMs
      });
      analyticsReadInFlight.delete(key);
      return value;
    })
    .catch((error) => {
      analyticsReadInFlight.delete(key);
      throw error;
    });

  analyticsReadInFlight.set(key, promise);
  return promise;
};

const clearAnalyticsReadCache = () => {
  analyticsReadCache.clear();
  analyticsReadInFlight.clear();
};

const buildSubmittedItemMatch = ({ agentId, customerId, startDate, endDate } = {}) => {
  const match = { status: 'submitted' };

  if (agentId) {
    match.agentId = toObjectId(agentId);
  }

  if (customerId) {
    match.customerId = toObjectId(customerId);
  }

  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return match;
};

const buildGroupedTotalsMatch = (field, match = {}, scopedIds = []) => {
  const groupedMatch = buildSubmittedItemMatch(match);
  const normalizedScopedIds = Array.isArray(scopedIds)
    ? scopedIds.map((value) => toObjectId(value)).filter(Boolean)
    : [];

  if (normalizedScopedIds.length) {
    groupedMatch[field] = { $in: normalizedScopedIds };
  }

  return groupedMatch;
};

const buildSlipMatch = ({ roundDate, marketId, agentId, customerId } = {}) => {
  const match = { status: 'submitted' };

  if (roundDate) {
    match.roundCode = roundDate;
  }

  if (marketId) {
    match.lotteryCode = normalizeLotteryCode(marketId);
  }

  if (agentId) {
    match.agentId = toObjectId(agentId);
  }

  if (customerId) {
    match.customerId = toObjectId(customerId);
  }

  return match;
};

const buildItemWithSlipPipeline = ({
  agentId,
  customerId,
  roundDate,
  marketId,
  startDate,
  endDate,
  resultIn = null
} = {}) => {
  const pipeline = [
    {
      $match: buildSubmittedItemMatch({ agentId, customerId, startDate, endDate })
    }
  ];

  if (Array.isArray(resultIn) && resultIn.length) {
    pipeline.push({
      $match: {
        result: { $in: resultIn }
      }
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: BetSlip.collection.name,
        localField: 'slipId',
        foreignField: '_id',
        as: 'slip'
      }
    },
    { $unwind: '$slip' }
  );

  const slipMatch = {};
  if (roundDate) {
    slipMatch['slip.roundCode'] = roundDate;
  }
  if (marketId) {
    slipMatch['slip.lotteryCode'] = normalizeLotteryCode(marketId);
  }

  if (Object.keys(slipMatch).length) {
    pipeline.push({ $match: slipMatch });
  }

  return pipeline;
};

const mapUserReference = (user) => {
  if (!user) return null;

  return {
    _id: user._id?.toString?.() || user._id,
    name: user.name || '',
    username: user.username || ''
  };
};

const getReferenceKey = (value) => value?._id?.toString?.() || value?.toString?.() || String(value || '');

const loadUserReferenceMap = async (userIds = []) => {
  const ids = [...new Set(userIds.map(getReferenceKey).filter(Boolean))];
  if (!ids.length) {
    return {};
  }

  const users = await User.find({ _id: { $in: ids } })
    .select('name username')
    .lean();

  return users.reduce((acc, user) => {
    acc[user._id.toString()] = user;
    return acc;
  }, {});
};

const attachUserReferences = async (items = []) => {
  const userIds = new Set();
  items.forEach((item) => {
    const customerId = getReferenceKey(item.customerId);
    const agentId = getReferenceKey(item.agentId);
    if (customerId) userIds.add(customerId);
    if (agentId) userIds.add(agentId);
  });

  if (!userIds.size) {
    return items;
  }

  const usersById = await loadUserReferenceMap([...userIds]);

  return items.map((item) => ({
    ...item,
    customerId: usersById[getReferenceKey(item.customerId)] || item.customerId,
    agentId: usersById[getReferenceKey(item.agentId)] || item.agentId
  }));
};

const mapBetItemToLegacyShape = (item) => ({
  _id: item._id.toString(),
  customerId: mapUserReference(item.customerId),
  agentId: mapUserReference(item.agentId),
  marketId: item.slipId?.lotteryCode || '',
  marketName: item.slipId?.lotteryName || '',
  roundDate: item.slipId?.roundCode || '',
  roundTitle: item.slipId?.roundTitle || '',
  slipId: item.slipId?._id?.toString?.() || item.slipId?.toString?.() || '',
  slipNumber: item.slipId?.slipNumber || '',
  memo: item.slipId?.memo || '',
  betType: item.betType,
  number: item.number,
  amount: item.amount,
  payRate: item.payRate,
  potentialPayout: item.potentialPayout,
  sequence: Number.isFinite(Number(item.sequence)) ? Number(item.sequence) : null,
  result: item.result,
  wonAmount: item.wonAmount || 0,
  isLocked: item.isLocked,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const mapBetItemToSlipSummaryItem = (item) => ({
  _id: item._id?.toString?.() || String(item._id || ''),
  betType: item.betType,
  number: item.number,
  amount: item.amount,
  payRate: item.payRate,
  potentialPayout: item.potentialPayout,
  sequence: Number.isFinite(Number(item.sequence)) ? Number(item.sequence) : null,
  result: item.result,
  wonAmount: item.wonAmount || 0,
  isLocked: item.isLocked,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const mapSlipToSummaryShape = ({ slip, items = [], usersById = {} }) => {
  const sortedItems = sortSlipItemsForDisplay(items);
  const totalStake = sortedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalWon = sortedItems.reduce((sum, item) => sum + Number(item.wonAmount || 0), 0);
  const totalPotentialPayout = sortedItems.reduce((sum, item) => sum + Number(item.potentialPayout || 0), 0);
  const hasPending = sortedItems.some((item) => (item.result || 'pending') === 'pending');
  const hasWon = sortedItems.some((item) => (item.result || 'pending') === 'won' || Number(item.wonAmount || 0) > 0);
  const slipId = slip._id?.toString?.() || String(slip._id || '');
  const customer = usersById[getReferenceKey(slip.customerId)] || slip.customerId;
  const agent = usersById[getReferenceKey(slip.agentId)] || slip.agentId;

  return {
    key: slipId,
    slipId,
    slipNumber: slip.slipNumber || '',
    customer: mapUserReference(customer),
    agent: mapUserReference(agent),
    marketId: slip.lotteryCode || '',
    marketName: slip.lotteryName || '',
    roundDate: slip.roundCode || '',
    roundLabel: slip.roundTitle || slip.roundCode || '',
    roundTitle: slip.roundTitle || '',
    createdAt: slip.createdAt,
    updatedAt: slip.updatedAt,
    memo: slip.memo || '',
    totalStake,
    totalWon,
    totalPotentialPayout,
    result: hasPending ? 'pending' : hasWon ? 'won' : 'lost',
    hasPending,
    hasWon,
    canCancel: hasPending,
    itemCount: Number(slip.itemCount || sortedItems.length || 0),
    items: sortedItems.map(mapBetItemToSlipSummaryItem)
  };
};

const sortSlipItemsForDisplay = (items = []) =>
  [...items].sort((left, right) => {
    const leftSequence = Number.isFinite(Number(left.sequence)) ? Number(left.sequence) : Number.MAX_SAFE_INTEGER;
    const rightSequence = Number.isFinite(Number(right.sequence)) ? Number(right.sequence) : Number.MAX_SAFE_INTEGER;

    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }

    const leftCreatedAt = new Date(left.createdAt || 0).getTime();
    const rightCreatedAt = new Date(right.createdAt || 0).getTime();
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return String(left._id || '').localeCompare(String(right._id || ''));
  });

const getBetTotals = async ({ agentId, customerId, startDate, endDate } = {}) => {
  const [summary, archivedTotals] = await Promise.all([
    BetItem.aggregate([
      {
        $match: buildSubmittedItemMatch({ agentId, customerId, startDate, endDate })
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalWon: { $sum: '$wonAmount' },
          totalBets: { $sum: 1 },
          pendingBets: {
            $sum: {
              $cond: [{ $eq: ['$result', 'pending'] }, 1, 0]
            }
          }
        }
      }
    ]),
    getArchivedBetTotals({ agentId, customerId, startDate, endDate })
  ]);

  return addBetTotals({
    totalAmount: summary[0]?.totalAmount || 0,
    totalWon: summary[0]?.totalWon || 0,
    totalBets: summary[0]?.totalBets || 0,
    pendingBets: summary[0]?.pendingBets || 0,
    netProfit: (summary[0]?.totalAmount || 0) - (summary[0]?.totalWon || 0)
  }, archivedTotals);
};

const getRecentBetItems = async ({ agentId, limit = 10 } = {}) => {
  const recentSlips = await BetSlip.find(buildSlipMatch({ agentId }))
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id');

  if (!recentSlips.length) {
    return [];
  }

  const slipOrder = new Map(recentSlips.map((slip, index) => [slip._id.toString(), index]));
  const items = await BetItem.find({
    ...buildSubmittedItemMatch({ agentId }),
    slipId: { $in: recentSlips.map((slip) => slip._id) }
  })
    .populate('customerId', 'name username')
    .populate('agentId', 'name username')
    .populate('slipId', 'slipNumber lotteryCode lotteryName roundCode roundTitle memo')
    .sort({ sequence: 1, createdAt: 1 });

  return items
    .sort((left, right) => {
      const leftSlipId = left.slipId?._id?.toString?.() || left.slipId?.toString?.() || '';
      const rightSlipId = right.slipId?._id?.toString?.() || right.slipId?.toString?.() || '';
      const slipDiff = (slipOrder.get(leftSlipId) ?? Number.MAX_SAFE_INTEGER) - (slipOrder.get(rightSlipId) ?? Number.MAX_SAFE_INTEGER);
      if (slipDiff !== 0) return slipDiff;

      const sequenceDiff = Number(left.sequence || 0) - Number(right.sequence || 0);
      if (sequenceDiff !== 0) return sequenceDiff;

      return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    })
    .map(mapBetItemToLegacyShape);
};

const getTotalsGroupedByField = async (field, match = {}, { scopedIds = [] } = {}) => {
  const [rows, archivedRows] = await Promise.all([
    BetItem.aggregate([
      { $match: buildGroupedTotalsMatch(field, match, scopedIds) },
      {
        $group: {
          _id: `$${field}`,
          totalAmount: { $sum: '$amount' },
          totalWon: { $sum: '$wonAmount' },
          count: { $sum: 1 }
        }
      }
    ]),
    getArchivedTotalsGroupedByField(field, match, { scopedIds })
  ]);

  const liveRows = rows.reduce((acc, row) => {
    if (row._id) {
      acc[row._id.toString()] = row;
    }
    return acc;
  }, {});

  return mergeGroupedTotals(liveRows, archivedRows);
};

const getAgentReportRows = async ({ agentId, roundDate, marketId, startDate, endDate, limit = 200 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const pipeline = buildItemWithSlipPipeline({ agentId, roundDate, marketId, startDate, endDate });

  pipeline.push(
    {
      $group: {
        _id: {
          roundDate: '$slip.roundCode',
          marketId: '$slip.lotteryCode',
          marketName: '$slip.lotteryName',
          agentId: '$agentId'
        },
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        betCount: { $sum: 1 },
        wonCount: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostCount: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }
    }
  );

  pipeline.push(
    {
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        agentId: '$_id.agentId',
        totalAmount: 1,
        totalWon: 1,
        netProfit: { $subtract: ['$totalAmount', '$totalWon'] },
        betCount: 1,
        wonCount: 1,
        lostCount: 1,
        pendingCount: 1
      }
    },
    {
      $sort: {
        roundDate: -1,
        marketName: 1
      }
    },
    { $limit: safeLimit }
  );

  const rows = await BetItem.aggregate(pipeline);
  const usersById = await loadUserReferenceMap(rows.map((row) => row.agentId));

  return rows.map((row) => {
    const agent = usersById[getReferenceKey(row.agentId)] || {};
    return {
      ...row,
      agentId: getReferenceKey(row.agentId),
      agentName: agent.name || '',
      agentUsername: agent.username || ''
    };
  });
};

const ADMIN_REPORT_SECTION_NAMES = new Set([
  'overview',
  'rows'
]);

const normalizeAdminReportSections = (sections = []) => {
  const rawSections = Array.isArray(sections)
    ? sections
    : String(sections || '').split(',');

  return new Set(
    rawSections
      .map((section) => String(section || '').trim())
      .filter((section) => ADMIN_REPORT_SECTION_NAMES.has(section))
  );
};

const createEmptyAdminReportOverview = () => ({
  totalAmount: 0,
  totalWon: 0,
  betCount: 0,
  wonCount: 0,
  lostCount: 0,
  pendingCount: 0,
  totalAgents: 0,
  netProfit: 0
});

const getAdminReportOverview = async ({ agentId, roundDate, marketId, startDate, endDate } = {}) => {
  const needsSlipLookup = Boolean(roundDate || marketId);
  const includeArchivedTotals = !needsSlipLookup && !startDate && !endDate;
  const basePipeline = needsSlipLookup
    ? buildItemWithSlipPipeline({ agentId, roundDate, marketId, startDate, endDate })
    : [{ $match: buildSubmittedItemMatch({ agentId, startDate, endDate }) }];

  const [rows, archivedTotals] = await Promise.all([
    BetItem.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalWon: { $sum: '$wonAmount' },
          betCount: { $sum: 1 },
          wonCount: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } },
          agentIds: { $addToSet: '$agentId' }
        }
      }
    ]),
    includeArchivedTotals
      ? getArchivedBetTotals({ agentId })
      : Promise.resolve(null)
  ]);

  const summary = rows[0] || {};
  const totalAmount = (summary.totalAmount || 0) + (archivedTotals?.totalAmount || 0);
  const totalWon = (summary.totalWon || 0) + (archivedTotals?.totalWon || 0);

  return {
    totalAmount,
    totalWon,
    betCount: (summary.betCount || 0) + (archivedTotals?.totalBets || 0),
    wonCount: (summary.wonCount || 0) + (archivedTotals?.wonBets || 0),
    lostCount: (summary.lostCount || 0) + (archivedTotals?.lostBets || 0),
    pendingCount: (summary.pendingCount || 0) + (archivedTotals?.pendingBets || 0),
    totalAgents: summary.agentIds?.length || 0,
    netProfit: totalAmount - totalWon
  };
};

const getAdminReportsBundle = async ({ agentId, roundDate, marketId, startDate, endDate, limit = 200, sections } = {}) =>
  loadWithAnalyticsReadCache(
    buildAnalyticsReadCacheKey('admin-reports-bundle', {
      agentId: agentId?.toString?.() || agentId || '',
      roundDate: roundDate || '',
      marketId: normalizeLotteryCode(marketId),
      startDate: startDate || '',
      endDate: endDate || '',
      limit,
      sections: Array.isArray(sections) ? sections.join(',') : String(sections || '')
    }),
    async () => {
      const sectionSet = normalizeAdminReportSections(sections);
      const includeAllSections = sectionSet.size === 0;
      const shouldLoad = (section) => includeAllSections || sectionSet.has(section);
      const [overview, rows] = await Promise.all([
        shouldLoad('overview')
          ? getAdminReportOverview({ agentId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('rows')
          ? getAgentReportRows({ agentId, roundDate, marketId, startDate, endDate, limit })
          : Promise.resolve(null)
      ]);

      return {
        generatedAt: new Date().toISOString(),
        filters: {
          roundDate: roundDate || '',
          marketId: normalizeLotteryCode(marketId),
          agentId: agentId || '',
          startDate: startDate || '',
          endDate: endDate || ''
        },
        overview: overview || createEmptyAdminReportOverview(),
        rows: rows || [],
        loadedSections: includeAllSections ? [...ADMIN_REPORT_SECTION_NAMES] : [...sectionSet]
      };
    }
  );

const getAgentReportOverview = async ({ agentId, customerId, roundDate, marketId, startDate, endDate } = {}) => {
  const needsSlipLookup = Boolean(roundDate || marketId);
  const includeArchivedTotals = !needsSlipLookup && !startDate && !endDate;
  const basePipeline = needsSlipLookup
    ? buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate })
    : [{ $match: buildSubmittedItemMatch({ agentId, customerId, startDate, endDate }) }];

  const [rows, archivedTotals] = await Promise.all([
    BetItem.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$amount' },
          totalPayout: { $sum: '$wonAmount' },
          totalPotentialPayout: { $sum: '$potentialPayout' },
          totalItems: { $sum: 1 },
          slipIds: { $addToSet: '$slipId' },
          customerIds: { $addToSet: '$customerId' },
          wonItems: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
          lostItems: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
          pendingItems: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } },
          pendingStake: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, '$amount', 0] } },
          pendingPotentialPayout: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, '$potentialPayout', 0] } },
          resolvedSales: { $sum: { $cond: [{ $ne: ['$result', 'pending'] }, '$amount', 0] } },
          resolvedPayout: { $sum: { $cond: [{ $ne: ['$result', 'pending'] }, '$wonAmount', 0] } }
        }
      }
    ]),
    includeArchivedTotals
      ? getArchivedBetTotals({ agentId, customerId })
      : Promise.resolve(null)
  ]);

  const summary = rows[0] || {};
  const totalSales = (summary.totalSales || 0) + (archivedTotals?.totalAmount || 0);
  const totalPayout = (summary.totalPayout || 0) + (archivedTotals?.totalWon || 0);
  const resolvedSales = (summary.resolvedSales || 0) + (archivedTotals?.totalAmount || 0);
  const resolvedPayout = (summary.resolvedPayout || 0) + (archivedTotals?.totalWon || 0);

  return {
    totalSales,
    totalPayout,
    totalPotentialPayout: summary.totalPotentialPayout || 0,
    totalItems: (summary.totalItems || 0) + (archivedTotals?.totalBets || 0),
    totalSlips: (summary.slipIds?.length || 0) + (archivedTotals?.totalSlips || 0),
    totalCustomers: summary.customerIds?.length || 0,
    wonItems: (summary.wonItems || 0) + (archivedTotals?.wonBets || 0),
    lostItems: (summary.lostItems || 0) + (archivedTotals?.lostBets || 0),
    pendingItems: (summary.pendingItems || 0) + (archivedTotals?.pendingBets || 0),
    pendingStake: summary.pendingStake || 0,
    pendingPotentialPayout: summary.pendingPotentialPayout || 0,
    resolvedSales,
    resolvedPayout,
    resolvedNetProfit: resolvedSales - resolvedPayout,
    projectedLiability: Math.max(0, (summary.pendingPotentialPayout || 0) - (summary.pendingStake || 0))
  };
};

const getAgentSalesSummary = async ({ agentId, customerId, roundDate, marketId, startDate, endDate } = {}) =>
  BetItem.aggregate([
    ...buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    {
      $group: {
        _id: {
          roundDate: '$slip.roundCode',
          marketId: '$slip.lotteryCode',
          marketName: '$slip.lotteryName'
        },
        totalSales: { $sum: '$amount' },
        totalPayout: { $sum: '$wonAmount' },
        totalPotentialPayout: { $sum: '$potentialPayout' },
        itemCount: { $sum: 1 },
        slipIds: { $addToSet: '$slipId' },
        customerIds: { $addToSet: '$customerId' },
        wonItems: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostItems: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
        pendingItems: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        totalSales: 1,
        totalPayout: 1,
        totalPotentialPayout: 1,
        itemCount: 1,
        slipCount: { $size: '$slipIds' },
        memberCount: { $size: '$customerIds' },
        wonItems: 1,
        lostItems: 1,
        pendingItems: 1,
        netProfit: { $subtract: ['$totalSales', '$totalPayout'] }
      }
    },
    {
      $sort: {
        roundDate: -1,
        marketName: 1
      }
    }
  ]);

const getAgentProjectedRows = async ({ agentId, customerId, roundDate, marketId, startDate, endDate } = {}) =>
  BetItem.aggregate([
    ...buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate, resultIn: ['pending'] }),
    {
      $group: {
        _id: {
          roundDate: '$slip.roundCode',
          marketId: '$slip.lotteryCode',
          marketName: '$slip.lotteryName'
        },
        pendingStake: { $sum: '$amount' },
        pendingPotentialPayout: { $sum: '$potentialPayout' },
        itemCount: { $sum: 1 },
        customerIds: { $addToSet: '$customerId' }
      }
    },
    {
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        pendingStake: 1,
        pendingPotentialPayout: 1,
        itemCount: 1,
        memberCount: { $size: '$customerIds' },
        projectedLiability: { $max: [0, { $subtract: ['$pendingPotentialPayout', '$pendingStake'] }] }
      }
    },
    {
      $sort: {
        projectedLiability: -1,
        pendingPotentialPayout: -1
      }
    }
  ]);

const getAgentExposureRows = async ({ agentId, customerId, roundDate, marketId, startDate, endDate, limit = 100 } = {}) =>
  BetItem.aggregate([
    ...buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate, resultIn: ['pending'] }),
    {
      $group: {
        _id: {
          roundDate: '$slip.roundCode',
          marketId: '$slip.lotteryCode',
          marketName: '$slip.lotteryName',
          betType: '$betType',
          number: '$number'
        },
        totalAmount: { $sum: '$amount' },
        totalPotentialPayout: { $sum: '$potentialPayout' },
        itemCount: { $sum: 1 },
        customerIds: { $addToSet: '$customerId' }
      }
    },
    {
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        betType: '$_id.betType',
        number: '$_id.number',
        totalAmount: 1,
        totalPotentialPayout: 1,
        itemCount: 1,
        memberCount: { $size: '$customerIds' }
      }
    },
    {
      $sort: {
        totalAmount: -1,
        totalPotentialPayout: -1
      }
    },
    { $limit: limit }
  ]);

const getAgentProfitLossRows = async ({ agentId, customerId, roundDate, marketId, startDate, endDate } = {}) =>
  BetItem.aggregate([
    ...buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate, resultIn: ['won', 'lost'] }),
    {
      $group: {
        _id: {
          roundDate: '$slip.roundCode',
          marketId: '$slip.lotteryCode',
          marketName: '$slip.lotteryName'
        },
        resolvedSales: { $sum: '$amount' },
        resolvedPayout: { $sum: '$wonAmount' },
        itemCount: { $sum: 1 },
        wonItems: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostItems: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        resolvedSales: 1,
        resolvedPayout: 1,
        itemCount: 1,
        wonItems: 1,
        lostItems: 1,
        netProfit: { $subtract: ['$resolvedSales', '$resolvedPayout'] }
      }
    },
    {
      $sort: {
        roundDate: -1,
        marketName: 1
      }
    }
  ]);

const listAgentReportItems = async ({
  agentId,
  roundDate,
  customerId,
  marketId,
  startDate,
  endDate,
  result,
  limit = 100,
  sort = { createdAt: -1 }
} = {}) => {
  const slips = await BetSlip.find(
    buildSlipMatch({ agentId, customerId, roundDate, marketId })
  )
    .select('_id slipNumber lotteryCode lotteryName roundCode roundTitle')
    .lean();

  if (!slips.length) {
    return [];
  }
  const slipById = slips.reduce((acc, slip) => {
    acc[slip._id.toString()] = slip;
    return acc;
  }, {});

  const rawItems = await BetItem.find({
    ...buildSubmittedItemMatch({ agentId, customerId, startDate, endDate }),
    ...(result ? { result } : {}),
    slipId: { $in: slips.map((item) => item._id) }
  })
    .select('_id customerId agentId slipId betType number amount payRate potentialPayout sequence result wonAmount isLocked createdAt updatedAt')
    .sort(sort)
    .limit(limit)
    .lean();
  const items = await attachUserReferences(rawItems);

  return items.map((item) => ({
    ...mapBetItemToLegacyShape({
      ...item,
      slipId: slipById[getReferenceKey(item.slipId)] || item.slipId
    }),
    netRisk: (item.potentialPayout || 0) - (item.amount || 0)
  }));
};

const REPORT_SECTION_NAMES = new Set([
  'overview',
  'salesSummary',
  'projectedRows',
  'exposureRows',
  'profitLossRows',
  'pendingRows',
  'winnerRows'
]);

const normalizeReportSections = (sections = []) => {
  const rawSections = Array.isArray(sections)
    ? sections
    : String(sections || '').split(',');

  return new Set(
    rawSections
      .map((section) => String(section || '').trim())
      .filter((section) => REPORT_SECTION_NAMES.has(section))
  );
};

const createEmptyReportOverview = () => ({
  totalSales: 0,
  totalPayout: 0,
  totalPotentialPayout: 0,
  totalItems: 0,
  totalSlips: 0,
  totalCustomers: 0,
  wonItems: 0,
  lostItems: 0,
  pendingItems: 0,
  pendingStake: 0,
  pendingPotentialPayout: 0,
  resolvedSales: 0,
  resolvedPayout: 0,
  resolvedNetProfit: 0,
  projectedLiability: 0
});

const getAgentReportsBundle = async ({ agentId, roundDate, marketId, customerId, startDate, endDate, sections } = {}) =>
  loadWithAnalyticsReadCache(
    buildAnalyticsReadCacheKey('agent-reports-bundle', {
      agentId: agentId?.toString?.() || agentId || '',
      roundDate: roundDate || '',
      marketId: normalizeLotteryCode(marketId),
      customerId: customerId || '',
      startDate: startDate || '',
      endDate: endDate || '',
      sections: Array.isArray(sections) ? sections.join(',') : String(sections || '')
    }),
    async () => {
      const sectionSet = normalizeReportSections(sections);
      const includeAllSections = sectionSet.size === 0;
      const shouldLoad = (section) => includeAllSections || sectionSet.has(section);
      const [overview, salesSummary, projectedRows, exposureRows, profitLossRows, pendingRows, winnerRows] = await Promise.all([
        shouldLoad('overview')
          ? getAgentReportOverview({ agentId, customerId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('salesSummary')
          ? getAgentSalesSummary({ agentId, customerId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('projectedRows')
          ? getAgentProjectedRows({ agentId, customerId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('exposureRows')
          ? getAgentExposureRows({ agentId, customerId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('profitLossRows')
          ? getAgentProfitLossRows({ agentId, customerId, roundDate, marketId, startDate, endDate })
          : Promise.resolve(null),
        shouldLoad('pendingRows')
          ? listAgentReportItems({ agentId, roundDate, customerId, marketId, startDate, endDate, result: 'pending', limit: 100, sort: { potentialPayout: -1, createdAt: -1 } })
          : Promise.resolve(null),
        shouldLoad('winnerRows')
          ? listAgentReportItems({ agentId, roundDate, customerId, marketId, startDate, endDate, result: 'won', limit: 100, sort: { wonAmount: -1, createdAt: -1 } })
          : Promise.resolve(null)
      ]);
      const resolvedSalesSummary = salesSummary || [];

      return {
        generatedAt: new Date().toISOString(),
        filters: {
          roundDate: roundDate || '',
          marketId: normalizeLotteryCode(marketId),
          customerId: customerId || '',
          startDate: startDate || '',
          endDate: endDate || ''
        },
        overview: overview || createEmptyReportOverview(),
        salesSummary: resolvedSalesSummary,
        projectedRows: projectedRows || [],
        exposureRows: exposureRows || [],
        profitLossRows: profitLossRows || [],
        pendingRows: pendingRows || [],
        winnerRows: winnerRows || [],
        loadedSections: includeAllSections ? [...REPORT_SECTION_NAMES] : [...sectionSet],
        legacyRows: resolvedSalesSummary.map((row) => ({
          roundDate: row.roundDate,
          marketId: row.marketId,
          marketName: row.marketName,
          totalAmount: row.totalSales,
          totalWon: row.totalPayout,
          netProfit: row.netProfit,
          betCount: row.itemCount,
          wonCount: row.wonItems,
          lostCount: row.lostItems,
          pendingCount: row.pendingItems
        }))
      };
    }
  );

const mapBetItemsBySlip = (items = []) => {
  const itemsBySlip = new Map();

  items.forEach((item) => {
    const slipId = item.slipId?._id?.toString?.() || item.slipId?.toString?.() || '';
    if (!slipId) return;
    if (!itemsBySlip.has(slipId)) {
      itemsBySlip.set(slipId, []);
    }
    itemsBySlip.get(slipId).push(item);
  });

  return itemsBySlip;
};

const formatItemsForOrderedSlips = (orderedSlipIds = [], items = []) => {
  const itemsBySlip = mapBetItemsBySlip(items);

  return orderedSlipIds.flatMap((slipId) =>
    sortSlipItemsForDisplay(itemsBySlip.get(slipId) || []).map(mapBetItemToLegacyShape)
  );
};

const listAgentBetItems = async ({
  agentId,
  roundDate,
  customerId,
  marketId,
  limit = 300,
  paginated = false,
  page = 1,
  skip = 0,
  summary = false
} = {}) =>
  loadWithAnalyticsReadCache(
    buildAnalyticsReadCacheKey('agent-bet-items', {
      agentId: agentId?.toString?.() || agentId || '',
      roundDate: roundDate || '',
      customerId: customerId || '',
      marketId: normalizeLotteryCode(marketId),
      limit,
      paginated,
      page,
      skip,
      summary
    }),
    async () => {
      if (paginated) {
        const slipMatch = buildSlipMatch({ agentId, customerId, roundDate, marketId });
        const slipsPlusOne = await BetSlip.find(slipMatch)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit + 1)
          .select('_id customerId agentId slipNumber lotteryCode lotteryName roundCode roundTitle memo itemCount totalAmount potentialPayout createdAt updatedAt')
          .lean();
        const hasNextPage = slipsPlusOne.length > limit;
        const slips = hasNextPage ? slipsPlusOne.slice(0, limit) : slipsPlusOne;
        const estimatedTotal = skip + slips.length + (hasNextPage ? 1 : 0);
        const totalPages = hasNextPage ? page + 1 : page;

        if (!slips.length) {
          return buildPaginatedResult([], {
            total: skip,
            page,
            limit,
            totalPages: page,
            hasNextPage: false
          });
        }

        const orderedSlipIds = slips.map((slip) => slip._id.toString());
        const slipById = slips.reduce((acc, slip) => {
          acc[slip._id.toString()] = slip;
          return acc;
        }, {});
        const [rawItems, usersById] = await Promise.all([
          BetItem.find({
            ...buildSubmittedItemMatch({ agentId, customerId }),
            slipId: { $in: slips.map((slip) => slip._id) }
          })
            .select('_id customerId agentId slipId betType number amount payRate potentialPayout sequence result wonAmount isLocked createdAt updatedAt')
            .lean(),
          loadUserReferenceMap(slips.flatMap((slip) => [slip.customerId, slip.agentId]))
        ]);
        const items = rawItems.map((item) => ({
          ...item,
          customerId: usersById[getReferenceKey(item.customerId)] || item.customerId,
          agentId: usersById[getReferenceKey(item.agentId)] || item.agentId
        }));

        if (summary) {
          const itemsBySlip = mapBetItemsBySlip(items);
          return buildPaginatedResult(
            orderedSlipIds.map((slipId) =>
              mapSlipToSummaryShape({
                slip: slipById[slipId],
                items: itemsBySlip.get(slipId) || [],
                usersById
              })
            ),
            {
              total: estimatedTotal,
              page,
              limit,
              totalPages,
              hasNextPage
            }
          );
        }

        const itemsWithSlips = items.map((item) => {
          const slipId = item.slipId?.toString?.() || String(item.slipId || '');
          return {
            ...item,
            slipId: slipById[slipId] || item.slipId
          };
        });

        return buildPaginatedResult(
          formatItemsForOrderedSlips(orderedSlipIds, itemsWithSlips),
          {
            total: estimatedTotal,
            page,
            limit,
            totalPages,
            hasNextPage
          }
        );
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
      const itemPipeline = buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId });
      itemPipeline.push(
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: safeLimit },
        {
          $project: {
            _id: 1,
            customerId: 1,
            agentId: 1,
            slipId: '$slip',
            betType: 1,
            number: 1,
            amount: 1,
            payRate: 1,
            potentialPayout: 1,
            sequence: 1,
            result: 1,
            wonAmount: 1,
            isLocked: 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      );

      const rawItems = await BetItem.aggregate(itemPipeline);
      const items = await attachUserReferences(rawItems);

      return items.map(mapBetItemToLegacyShape);
    }
  );

const listBettingRecentItems = async ({
  actorRole,
  actorId,
  customerId,
  roundDate,
  marketId,
  limit = 12
} = {}) => {
  const agentId = actorRole === 'agent' ? actorId : undefined;
  return listAgentBetItems({
    agentId,
    customerId,
    roundDate,
    marketId,
    limit
  });
};

module.exports = {
  getBetTotals,
  getRecentBetItems,
  getTotalsGroupedByField,
  getAgentReportRows,
  getAdminReportsBundle,
  listAgentBetItems,
  listBettingRecentItems,
  getAgentReportsBundle,
  clearAnalyticsReadCache,
  __test: {
    buildGroupedTotalsMatch,
    DEFAULT_ANALYTICS_READ_CACHE_TTL_MS
  }
};
