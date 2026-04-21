const VALID_ADMIN_CUSTOMER_STATUSES = new Set(['active', 'inactive', 'suspended']);
const VALID_ADMIN_CUSTOMER_SORTS = new Set(['recent', 'sales_desc', 'profit_desc', 'name_asc']);

const toText = (value) => String(value || '').trim();
const toId = (row) => row?._id?.toString?.() || String(row?._id || row || '');
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toTime = (value) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const getTotalAmount = (totals = {}) => Number(totals.totalAmount || 0);
const getNetProfit = (totals = {}) => Number(totals.totalAmount || 0) - Number(totals.totalWon || 0);

const normalizeAdminCustomerQuery = ({
  agentId = '',
  search = '',
  status = '',
  sortBy = 'recent'
} = {}) => {
  const normalizedStatus = toText(status);
  const normalizedSort = toText(sortBy) || 'recent';

  return {
    agentId: toText(agentId),
    search: toText(search),
    status: VALID_ADMIN_CUSTOMER_STATUSES.has(normalizedStatus) ? normalizedStatus : '',
    sortBy: VALID_ADMIN_CUSTOMER_SORTS.has(normalizedSort) ? normalizedSort : 'recent'
  };
};

const buildAdminCustomerFilter = (query = {}) => {
  const { agentId, search, status } = normalizeAdminCustomerQuery(query);
  const filter = { role: 'customer' };

  if (agentId) {
    filter.agentId = agentId;
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [
      { name: regex },
      { username: regex },
      { phone: regex }
    ];
  }

  return filter;
};

const buildAdminCustomerSort = (sortBy = 'recent') => {
  const normalizedSort = normalizeAdminCustomerQuery({ sortBy }).sortBy;

  if (normalizedSort === 'name_asc') {
    return {
      name: 1,
      username: 1,
      _id: 1
    };
  }

  if (normalizedSort === 'sales_desc' || normalizedSort === 'profit_desc') {
    return null;
  }

  return {
    updatedAt: -1,
    createdAt: -1,
    _id: -1
  };
};

const compareRecent = (left, right) =>
  toTime(right.updatedAt || right.lastActiveAt || right.createdAt) -
  toTime(left.updatedAt || left.lastActiveAt || left.createdAt);

const sortAdminCustomerRowsByTotals = (rows = [], totalsByCustomer = {}, sortBy = 'recent') => {
  const normalizedSort = normalizeAdminCustomerQuery({ sortBy }).sortBy;

  if (normalizedSort !== 'sales_desc' && normalizedSort !== 'profit_desc') {
    return [...rows];
  }

  const getMetric = normalizedSort === 'sales_desc' ? getTotalAmount : getNetProfit;

  return [...rows].sort((left, right) => {
    const leftTotals = totalsByCustomer[toId(left)] || {};
    const rightTotals = totalsByCustomer[toId(right)] || {};
    const metricDiff = getMetric(rightTotals) - getMetric(leftTotals);
    if (metricDiff !== 0) return metricDiff;

    const recentDiff = compareRecent(left, right);
    if (recentDiff !== 0) return recentDiff;

    return toId(left).localeCompare(toId(right));
  });
};

module.exports = {
  buildAdminCustomerFilter,
  buildAdminCustomerSort,
  normalizeAdminCustomerQuery,
  sortAdminCustomerRowsByTotals
};
