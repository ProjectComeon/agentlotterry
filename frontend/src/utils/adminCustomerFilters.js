const VALID_ADMIN_CUSTOMER_STATUSES = new Set(['active', 'inactive', 'suspended']);
const VALID_ADMIN_CUSTOMER_SORTS = new Set(['recent', 'sales_desc', 'profit_desc', 'name_asc']);

export const DEFAULT_ADMIN_CUSTOMER_FILTERS = {
  search: '',
  agentId: '',
  status: '',
  sortBy: 'recent'
};

const toText = (value) => String(value || '').trim();

export const normalizeAdminCustomerFilters = (filters = {}) => {
  const status = toText(filters.status);
  const sortBy = toText(filters.sortBy) || DEFAULT_ADMIN_CUSTOMER_FILTERS.sortBy;

  return {
    search: toText(filters.search),
    agentId: toText(filters.agentId),
    status: VALID_ADMIN_CUSTOMER_STATUSES.has(status) ? status : '',
    sortBy: VALID_ADMIN_CUSTOMER_SORTS.has(sortBy) ? sortBy : DEFAULT_ADMIN_CUSTOMER_FILTERS.sortBy
  };
};

export const areAdminCustomerFiltersEqual = (left = {}, right = {}) => {
  const normalizedLeft = normalizeAdminCustomerFilters(left);
  const normalizedRight = normalizeAdminCustomerFilters(right);

  return (
    normalizedLeft.search === normalizedRight.search &&
    normalizedLeft.agentId === normalizedRight.agentId &&
    normalizedLeft.status === normalizedRight.status &&
    normalizedLeft.sortBy === normalizedRight.sortBy
  );
};
