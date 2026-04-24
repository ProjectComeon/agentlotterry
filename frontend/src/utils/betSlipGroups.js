import { formatRoundLabel } from './formatters';
import { buildSlipDisplayGroups } from './slipGrouping';

const getReferenceId = (value) => String(value?.id || value?._id || value || '');

const asNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const sumItems = (items, field) => items.reduce((sum, item) => sum + asNumber(item?.[field]), 0);

const resolveSlipResult = ({ result, hasPending, hasWon }) => {
  if (result) return result;
  if (hasPending) return 'pending';
  return hasWon ? 'won' : 'lost';
};

const normalizeSummaryRecord = (slip, { defaultMarket = '', emptyMemo = '' } = {}) => {
  const items = Array.isArray(slip?.items) ? slip.items : [];
  const hasPending = typeof slip?.hasPending === 'boolean'
    ? slip.hasPending
    : items.some((item) => (item?.result || 'pending') === 'pending');
  const hasWon = typeof slip?.hasWon === 'boolean'
    ? slip.hasWon
    : items.some((item) => (item?.result || 'pending') === 'won' || asNumber(item?.wonAmount) > 0);
  const totalStake = asNumber(slip?.totalStake, sumItems(items, 'amount'));
  const totalWon = asNumber(slip?.totalWon, sumItems(items, 'wonAmount'));
  const totalPotentialPayout = asNumber(slip?.totalPotentialPayout, sumItems(items, 'potentialPayout'));
  const displayGroups = Array.isArray(slip?.displayGroups) && slip.displayGroups.length
    ? slip.displayGroups
    : buildSlipDisplayGroups(items);

  return {
    ...slip,
    key: slip?.key || slip?.slipId || `${getReferenceId(slip?.customer || slip?.customerId)}-${slip?.roundDate}-${slip?.marketId}-${slip?.createdAt}`,
    slipId: slip?.slipId || '',
    slipNumber: slip?.slipNumber || '',
    customer: slip?.customer || slip?.customerId || null,
    agent: slip?.agent || slip?.agentId || null,
    marketId: slip?.marketId || '',
    marketName: slip?.marketName || defaultMarket,
    roundDate: slip?.roundDate,
    roundLabel: formatRoundLabel(slip?.roundTitle || slip?.roundLabel || slip?.roundDate || '-'),
    createdAt: slip?.createdAt,
    items,
    displayGroups,
    totalStake,
    totalWon,
    totalPotentialPayout,
    memo: slip?.memo || emptyMemo,
    hasPending,
    hasWon,
    result: resolveSlipResult({ result: slip?.result, hasPending, hasWon }),
    canCancel: typeof slip?.canCancel === 'boolean' ? slip.canCancel : hasPending && Boolean(slip?.slipId),
    itemCount: asNumber(slip?.itemCount, items.length)
  };
};

const isSummaryRecord = (item) => Boolean(item && Array.isArray(item.items) && !item.betType);

export const groupBetsBySlip = (bets = [], options = {}) => {
  if (bets.some(isSummaryRecord)) {
    return bets
      .map((slip) => normalizeSummaryRecord(slip, options))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }

  const grouped = new Map();

  bets.forEach((bet) => {
    const slipKey =
      bet.slipId ||
      bet.slipNumber ||
      `${getReferenceId(bet.customerId)}-${bet.roundDate}-${bet.marketId}-${bet.createdAt}`;

    const current = grouped.get(slipKey);
    if (current) {
      current.items.push(bet);
      current.totalStake += asNumber(bet.amount);
      current.totalWon += asNumber(bet.wonAmount);
      current.totalPotentialPayout += asNumber(bet.potentialPayout);
      current.memo = current.memo || bet.memo || '';
      current.hasPending = current.hasPending || (bet.result || 'pending') === 'pending';
      current.hasWon = current.hasWon || (bet.result || 'pending') === 'won' || asNumber(bet.wonAmount) > 0;
      if (new Date(bet.createdAt || 0) > new Date(current.createdAt || 0)) {
        current.createdAt = bet.createdAt;
      }
      return;
    }

    grouped.set(slipKey, {
      key: slipKey,
      slipId: bet.slipId || '',
      slipNumber: bet.slipNumber || '',
      customer: bet.customerId,
      agent: bet.agentId,
      marketId: bet.marketId || '',
      marketName: bet.marketName || options.defaultMarket,
      roundDate: bet.roundDate,
      roundLabel: formatRoundLabel(bet.roundTitle || bet.roundDate || '-'),
      createdAt: bet.createdAt,
      items: [bet],
      totalStake: asNumber(bet.amount),
      totalWon: asNumber(bet.wonAmount),
      totalPotentialPayout: asNumber(bet.potentialPayout),
      memo: bet.memo || '',
      hasPending: (bet.result || 'pending') === 'pending',
      hasWon: (bet.result || 'pending') === 'won' || asNumber(bet.wonAmount) > 0
    });
  });

  return [...grouped.values()]
    .map((group) => normalizeSummaryRecord(group, options))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
};
