export const DEFAULT_BET_HISTORY_QUERY_FILTERS = Object.freeze({
  roundDate: '',
  agentId: ''
});

const toFilterText = (value) => String(value || '').trim();

export const normalizeBetHistoryQueryFilters = (filters = {}) => ({
  roundDate: toFilterText(filters.roundDate),
  agentId: toFilterText(filters.agentId)
});

export const areBetHistoryQueryFiltersEqual = (
  left = DEFAULT_BET_HISTORY_QUERY_FILTERS,
  right = DEFAULT_BET_HISTORY_QUERY_FILTERS
) => {
  const normalizedLeft = normalizeBetHistoryQueryFilters(left);
  const normalizedRight = normalizeBetHistoryQueryFilters(right);

  return (
    normalizedLeft.roundDate === normalizedRight.roundDate &&
    normalizedLeft.agentId === normalizedRight.agentId
  );
};
