export const DEFAULT_MEMBER_LIST_FILTERS = Object.freeze({
  search: '',
  status: '',
  online: ''
});

const toFilterText = (value) => String(value || '').trim();

export const normalizeMemberListFilters = (filters = {}) => ({
  search: toFilterText(filters.search),
  status: toFilterText(filters.status),
  online: toFilterText(filters.online)
});

export const areMemberListFiltersEqual = (left = DEFAULT_MEMBER_LIST_FILTERS, right = DEFAULT_MEMBER_LIST_FILTERS) => {
  const normalizedLeft = normalizeMemberListFilters(left);
  const normalizedRight = normalizeMemberListFilters(right);

  return (
    normalizedLeft.search === normalizedRight.search &&
    normalizedLeft.status === normalizedRight.status &&
    normalizedLeft.online === normalizedRight.online
  );
};
