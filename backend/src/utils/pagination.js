const DEFAULT_PAGINATION_PAGE = 1;
const DEFAULT_PAGINATION_LIMIT = 25;
const MAX_PAGINATION_LIMIT = 100;

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const isTruthyFlag = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const parsePaginationQuery = (
  {
    page,
    limit,
    paginated
  } = {},
  {
    defaultLimit = DEFAULT_PAGINATION_LIMIT,
    maxLimit = MAX_PAGINATION_LIMIT
  } = {}
) => {
  const normalizedPage = normalizePositiveInteger(page, DEFAULT_PAGINATION_PAGE);
  const normalizedLimit = Math.min(
    normalizePositiveInteger(limit, defaultLimit),
    maxLimit
  );
  const shouldPaginate =
    isTruthyFlag(paginated) ||
    page !== undefined ||
    limit !== undefined;

  return {
    paginated: shouldPaginate,
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit
  };
};

const buildPaginatedResult = (
  items,
  {
    total = 0,
    page = DEFAULT_PAGINATION_PAGE,
    limit = DEFAULT_PAGINATION_LIMIT,
    totalPages,
    hasNextPage
  } = {}
) => {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePage = normalizePositiveInteger(page, DEFAULT_PAGINATION_PAGE);
  const safeLimit = normalizePositiveInteger(limit, DEFAULT_PAGINATION_LIMIT);
  const safeTotalPages = normalizePositiveInteger(
    totalPages,
    Math.max(1, Math.ceil(safeTotal / safeLimit))
  );

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: safeTotal,
      totalPages: safeTotalPages,
      hasPrevPage: safePage > 1,
      hasNextPage: hasNextPage === undefined ? safePage < safeTotalPages : Boolean(hasNextPage)
    }
  };
};

module.exports = {
  DEFAULT_PAGINATION_PAGE,
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  buildPaginatedResult,
  parsePaginationQuery
};
