const hiddenRoundStatuses = new Set(['closed', 'resulted']);

const buildSelectableRounds = (loadedRounds = [], activeRound = null) => {
  const sourceRounds = Array.isArray(loadedRounds) && loadedRounds.length
    ? loadedRounds
    : activeRound
      ? [activeRound]
      : [];

  const visibleRounds = sourceRounds.filter((round) => !hiddenRoundStatuses.has(round?.status));
  return visibleRounds.length ? visibleRounds : sourceRounds;
};

const shouldFetchRoundsForLottery = ({
  lotteryId = '',
  loadedLotteryId = '',
  loadedRounds = [],
  hasActiveRound = false,
  requiresHistoricalRounds = false
} = {}) => {
  if (!lotteryId) {
    return false;
  }

  if (loadedLotteryId === lotteryId && Array.isArray(loadedRounds) && loadedRounds.length) {
    return false;
  }

  if (requiresHistoricalRounds) {
    return true;
  }

  return !hasActiveRound;
};

export {
  buildSelectableRounds,
  shouldFetchRoundsForLottery
};
