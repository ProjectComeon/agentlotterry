const { Types } = require('mongoose');
const RetentionArchiveSummary = require('../models/RetentionArchiveSummary');

const EMPTY_BET_TOTALS = Object.freeze({
  totalAmount: 0,
  totalWon: 0,
  totalBets: 0,
  pendingBets: 0,
  netProfit: 0
});

const EMPTY_GROUPED_TOTALS = Object.freeze({});

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || String(value || '');

const toObjectId = (value) => {
  const id = toIdString(value);
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
};

const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const hasDateFilter = ({ startDate, endDate } = {}) => Boolean(startDate || endDate);

const makeScopeKey = (scope, parts = {}) => {
  if (scope === 'global') return 'global';
  if (scope === 'wallet_global') return 'wallet_global';

  const values = {
    agent: ['agentId'],
    customer: ['customerId'],
    lottery: ['lotteryTypeId'],
    agent_customer: ['agentId', 'customerId'],
    agent_lottery: ['agentId', 'lotteryTypeId'],
    customer_lottery: ['customerId', 'lotteryTypeId'],
    wallet_user: ['userId']
  }[scope];

  if (!values) {
    throw new Error(`Unsupported retention archive scope: ${scope}`);
  }

  return values.map((key) => toIdString(parts[key])).join(':');
};

const normalizeBetTotals = (summary = {}) => ({
  totalAmount: toAmount(summary.totalAmount),
  totalWon: toAmount(summary.totalWon),
  totalBets: toAmount(summary.totalBets),
  totalSlips: toAmount(summary.totalSlips),
  wonBets: toAmount(summary.wonBets),
  lostBets: toAmount(summary.lostBets),
  pendingBets: toAmount(summary.pendingBets),
  netProfit: toAmount(summary.netProfit ?? (toAmount(summary.totalAmount) - toAmount(summary.totalWon)))
});

const normalizeGroupedTotals = (summary = {}) => ({
  totalAmount: toAmount(summary.totalAmount),
  totalWon: toAmount(summary.totalWon),
  count: toAmount(summary.totalBets ?? summary.count),
  pendingBets: toAmount(summary.pendingBets)
});

const addBetTotals = (current = EMPTY_BET_TOTALS, archived = EMPTY_BET_TOTALS) => {
  const totalAmount = toAmount(current.totalAmount) + toAmount(archived.totalAmount);
  const totalWon = toAmount(current.totalWon) + toAmount(archived.totalWon);

  return {
    totalAmount,
    totalWon,
    totalBets: toAmount(current.totalBets) + toAmount(archived.totalBets),
    pendingBets: toAmount(current.pendingBets) + toAmount(archived.pendingBets),
    netProfit: totalAmount - totalWon
  };
};

const addGroupedTotal = (current = {}, archived = {}) => ({
  ...current,
  totalAmount: toAmount(current.totalAmount) + toAmount(archived.totalAmount),
  totalWon: toAmount(current.totalWon) + toAmount(archived.totalWon),
  count: toAmount(current.count) + toAmount(archived.count),
  pendingBets: toAmount(current.pendingBets) + toAmount(archived.pendingBets)
});

const resolveBetSummaryScope = ({ agentId, customerId, lotteryTypeId } = {}) => {
  if (agentId && customerId) {
    return {
      scope: 'agent_customer',
      scopeKey: makeScopeKey('agent_customer', { agentId, customerId })
    };
  }

  if (agentId && lotteryTypeId) {
    return {
      scope: 'agent_lottery',
      scopeKey: makeScopeKey('agent_lottery', { agentId, lotteryTypeId })
    };
  }

  if (customerId && lotteryTypeId) {
    return {
      scope: 'customer_lottery',
      scopeKey: makeScopeKey('customer_lottery', { customerId, lotteryTypeId })
    };
  }

  if (customerId) {
    return {
      scope: 'customer',
      scopeKey: makeScopeKey('customer', { customerId })
    };
  }

  if (agentId) {
    return {
      scope: 'agent',
      scopeKey: makeScopeKey('agent', { agentId })
    };
  }

  if (lotteryTypeId) {
    return {
      scope: 'lottery',
      scopeKey: makeScopeKey('lottery', { lotteryTypeId })
    };
  }

  return {
    scope: 'global',
    scopeKey: makeScopeKey('global')
  };
};

const getArchivedBetTotals = async ({
  agentId,
  customerId,
  lotteryTypeId,
  startDate,
  endDate
} = {}) => {
  if (hasDateFilter({ startDate, endDate })) {
    return { ...EMPTY_BET_TOTALS };
  }

  const { scope, scopeKey } = resolveBetSummaryScope({ agentId, customerId, lotteryTypeId });
  const row = await RetentionArchiveSummary.findOne({ scope, scopeKey })
    .select('totalAmount totalWon totalBets totalSlips wonBets lostBets pendingBets netProfit')
    .lean();

  return normalizeBetTotals(row || {});
};

const buildGroupedArchiveQuery = (field, match = {}, scopedIds = []) => {
  const normalizedScopedIds = Array.isArray(scopedIds)
    ? scopedIds.map(toObjectId).filter(Boolean)
    : [];

  if (match.startDate || match.endDate) {
    return null;
  }

  if (field === 'customerId') {
    const query = match.agentId
      ? { scope: 'agent_customer', agentId: toObjectId(match.agentId) }
      : { scope: 'customer' };

    if (normalizedScopedIds.length) {
      query.customerId = { $in: normalizedScopedIds };
    }
    return { query, keyField: 'customerId' };
  }

  if (field === 'agentId') {
    const query = { scope: 'agent' };
    if (normalizedScopedIds.length) {
      query.agentId = { $in: normalizedScopedIds };
    }
    return { query, keyField: 'agentId' };
  }

  if (field === 'lotteryTypeId') {
    const query = match.agentId
      ? { scope: 'agent_lottery', agentId: toObjectId(match.agentId) }
      : match.customerId
        ? { scope: 'customer_lottery', customerId: toObjectId(match.customerId) }
        : { scope: 'lottery' };

    if (normalizedScopedIds.length) {
      query.lotteryTypeId = { $in: normalizedScopedIds };
    }
    return { query, keyField: 'lotteryTypeId' };
  }

  return null;
};

const getArchivedTotalsGroupedByField = async (field, match = {}, { scopedIds = [] } = {}) => {
  const archiveQuery = buildGroupedArchiveQuery(field, match, scopedIds);
  if (!archiveQuery) {
    return { ...EMPTY_GROUPED_TOTALS };
  }

  const rows = await RetentionArchiveSummary.find(archiveQuery.query)
    .select(`${archiveQuery.keyField} totalAmount totalWon totalBets pendingBets`)
    .lean();

  return rows.reduce((acc, row) => {
    const key = toIdString(row[archiveQuery.keyField]);
    if (key) {
      acc[key] = normalizeGroupedTotals(row);
    }
    return acc;
  }, {});
};

const mergeGroupedTotals = (current = {}, archived = {}) => {
  const result = { ...current };

  Object.entries(archived || {}).forEach(([key, archivedTotals]) => {
    result[key] = addGroupedTotal(result[key] || { _id: key }, archivedTotals);
  });

  return result;
};

const incrementArchiveSummary = async ({ scope, parts = {}, totals = {}, cutoff, runId }) => {
  const scopeKey = makeScopeKey(scope, parts);
  const totalAmount = toAmount(totals.totalAmount);
  const totalWon = toAmount(totals.totalWon);
  const netProfit = totalAmount - totalWon;
  const ledgerCredit = toAmount(totals.ledgerCredit);
  const ledgerDebit = toAmount(totals.ledgerDebit);

  await RetentionArchiveSummary.updateOne(
    { scope, scopeKey },
    {
      $setOnInsert: {
        scope,
        scopeKey,
        agentId: toObjectId(parts.agentId),
        customerId: toObjectId(parts.customerId),
        lotteryTypeId: toObjectId(parts.lotteryTypeId),
        userId: toObjectId(parts.userId)
      },
      $inc: {
        totalAmount,
        totalWon,
        netProfit,
        totalBets: toAmount(totals.totalBets),
        totalSlips: toAmount(totals.totalSlips),
        wonBets: toAmount(totals.wonBets),
        lostBets: toAmount(totals.lostBets),
        pendingBets: toAmount(totals.pendingBets),
        ledgerCredit,
        ledgerDebit,
        ledgerNet: ledgerCredit - ledgerDebit,
        ledgerCount: toAmount(totals.ledgerCount)
      },
      $max: {
        archivedBefore: cutoff
      },
      $set: {
        lastRunId: runId || '',
        lastArchivedAt: new Date()
      }
    },
    { upsert: true }
  );
};

module.exports = {
  addBetTotals,
  getArchivedBetTotals,
  getArchivedTotalsGroupedByField,
  incrementArchiveSummary,
  makeScopeKey,
  mergeGroupedTotals,
  resolveBetSummaryScope,
  __test: {
    buildGroupedArchiveQuery,
    makeScopeKey,
    resolveBetSummaryScope
  }
};
