const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const User = require('../models/User');
const { normalizeLotteryCode } = require('../utils/lotteryCode');

const buildSubmittedItemMatch = ({ agentId, customerId, startDate, endDate } = {}) => {
  const match = { status: 'submitted' };

  if (agentId) {
    match.agentId = agentId;
  }

  if (customerId) {
    match.customerId = customerId;
  }

  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return match;
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
    match.agentId = agentId;
  }

  if (customerId) {
    match.customerId = customerId;
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
  result: item.result,
  wonAmount: item.wonAmount || 0,
  isLocked: item.isLocked,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const getBetTotals = async ({ agentId, customerId, startDate, endDate } = {}) => {
  const summary = await BetItem.aggregate([
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
  ]);

  return {
    totalAmount: summary[0]?.totalAmount || 0,
    totalWon: summary[0]?.totalWon || 0,
    totalBets: summary[0]?.totalBets || 0,
    pendingBets: summary[0]?.pendingBets || 0,
    netProfit: (summary[0]?.totalAmount || 0) - (summary[0]?.totalWon || 0)
  };
};

const getRecentBetItems = async ({ agentId, limit = 10 } = {}) => {
  const items = await BetItem.find(buildSubmittedItemMatch({ agentId }))
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('customerId', 'name username')
    .populate('agentId', 'name username')
    .populate('slipId', 'slipNumber lotteryCode lotteryName roundCode roundTitle');

  return items.map(mapBetItemToLegacyShape);
};

const getTotalsGroupedByField = async (field, match = {}) => {
  const rows = await BetItem.aggregate([
    { $match: buildSubmittedItemMatch(match) },
    {
      $group: {
        _id: `$${field}`,
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return rows.reduce((acc, row) => {
    if (row._id) {
      acc[row._id.toString()] = row;
    }
    return acc;
  }, {});
};

const getAgentReportRows = async ({ agentId, roundDate, marketId, startDate, endDate } = {}) => {
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

  if (!agentId) {
    pipeline.push(
      {
        $lookup: {
          from: User.collection.name,
          localField: '_id.agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      {
        $unwind: {
          path: '$agent',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          roundDate: '$_id.roundDate',
          marketId: '$_id.marketId',
          marketName: '$_id.marketName',
          agentName: '$agent.name',
          agentUsername: '$agent.username',
          totalAmount: 1,
          totalWon: 1,
          netProfit: { $subtract: ['$totalAmount', '$totalWon'] },
          betCount: 1,
          wonCount: 1,
          lostCount: 1,
          pendingCount: 1
        }
      }
    );
  } else {
    pipeline.push({
      $project: {
        _id: 0,
        roundDate: '$_id.roundDate',
        marketId: '$_id.marketId',
        marketName: '$_id.marketName',
        totalAmount: 1,
        totalWon: 1,
        netProfit: { $subtract: ['$totalAmount', '$totalWon'] },
        betCount: 1,
        wonCount: 1,
        lostCount: 1,
        pendingCount: 1
      }
    });
  }

  pipeline.push({
    $sort: {
      roundDate: -1,
      marketName: 1
    }
  });

  return BetItem.aggregate(pipeline);
};

const getAgentReportOverview = async ({ agentId, customerId, roundDate, marketId, startDate, endDate } = {}) => {
  const rows = await BetItem.aggregate([
    ...buildItemWithSlipPipeline({ agentId, customerId, roundDate, marketId, startDate, endDate }),
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
  ]);

  const summary = rows[0];
  if (!summary) {
    return {
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
    };
  }

  return {
    totalSales: summary.totalSales || 0,
    totalPayout: summary.totalPayout || 0,
    totalPotentialPayout: summary.totalPotentialPayout || 0,
    totalItems: summary.totalItems || 0,
    totalSlips: summary.slipIds?.length || 0,
    totalCustomers: summary.customerIds?.length || 0,
    wonItems: summary.wonItems || 0,
    lostItems: summary.lostItems || 0,
    pendingItems: summary.pendingItems || 0,
    pendingStake: summary.pendingStake || 0,
    pendingPotentialPayout: summary.pendingPotentialPayout || 0,
    resolvedSales: summary.resolvedSales || 0,
    resolvedPayout: summary.resolvedPayout || 0,
    resolvedNetProfit: (summary.resolvedSales || 0) - (summary.resolvedPayout || 0),
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
  const slipIds = await BetSlip.find(
    buildSlipMatch({ agentId, customerId, roundDate, marketId })
  ).select('_id');

  if (!slipIds.length) {
    return [];
  }

  const items = await BetItem.find({
    ...buildSubmittedItemMatch({ agentId, customerId, startDate, endDate }),
    ...(result ? { result } : {}),
    slipId: { $in: slipIds.map((item) => item._id) }
  })
    .sort(sort)
    .limit(limit)
    .populate('customerId', 'name username')
    .populate('agentId', 'name username')
    .populate('slipId', 'slipNumber lotteryCode lotteryName roundCode roundTitle');

  return items.map((item) => ({
    ...mapBetItemToLegacyShape(item),
    netRisk: (item.potentialPayout || 0) - (item.amount || 0)
  }));
};

const getAgentReportsBundle = async ({ agentId, roundDate, marketId, customerId, startDate, endDate } = {}) => {
  const [overview, salesSummary, projectedRows, exposureRows, profitLossRows, pendingRows, winnerRows] = await Promise.all([
    getAgentReportOverview({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    getAgentSalesSummary({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    getAgentProjectedRows({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    getAgentExposureRows({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    getAgentProfitLossRows({ agentId, customerId, roundDate, marketId, startDate, endDate }),
    listAgentReportItems({ agentId, roundDate, customerId, marketId, startDate, endDate, result: 'pending', limit: 100, sort: { potentialPayout: -1, createdAt: -1 } }),
    listAgentReportItems({ agentId, roundDate, customerId, marketId, startDate, endDate, result: 'won', limit: 100, sort: { wonAmount: -1, createdAt: -1 } })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      roundDate: roundDate || '',
      marketId: normalizeLotteryCode(marketId),
      customerId: customerId || '',
      startDate: startDate || '',
      endDate: endDate || ''
    },
    overview,
    salesSummary,
    projectedRows,
    exposureRows,
    profitLossRows,
    pendingRows,
    winnerRows,
    legacyRows: salesSummary.map((row) => ({
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
};

const listAgentBetItems = async ({ agentId, roundDate, customerId, marketId, limit = 300 } = {}) => {
  const slipIds = await BetSlip.find(
    buildSlipMatch({ agentId, customerId, roundDate, marketId })
  ).select('_id');

  if (!slipIds.length) {
    return [];
  }

  const items = await BetItem.find({
    ...buildSubmittedItemMatch({ agentId, customerId }),
    slipId: { $in: slipIds.map((item) => item._id) }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('customerId', 'name username')
    .populate('agentId', 'name username')
    .populate('slipId', 'slipNumber lotteryCode lotteryName roundCode roundTitle memo');

  return items.map(mapBetItemToLegacyShape);
};

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
  listAgentBetItems,
  listBettingRecentItems,
  getAgentReportsBundle
};
