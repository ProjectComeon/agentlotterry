export const DEFAULT_PAGINATION_META = {
  page: 1,
  limit: 0,
  total: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false
};

export const isPaginatedResponse = (payload) =>
  Boolean(
    payload &&
    !Array.isArray(payload) &&
    Array.isArray(payload.items) &&
    payload.pagination &&
    typeof payload.pagination === 'object'
  );

export const getPaginatedItems = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isPaginatedResponse(payload)) {
    return payload.items;
  }

  return [];
};

export const getPaginatedMeta = (payload) => {
  if (isPaginatedResponse(payload)) {
    return {
      ...DEFAULT_PAGINATION_META,
      ...payload.pagination
    };
  }

  const items = Array.isArray(payload) ? payload : [];
  const total = items.length;

  return {
    ...DEFAULT_PAGINATION_META,
    limit: total,
    total
  };
};
