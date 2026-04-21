const DEFAULT_REFERENCE_DATA_CACHE_TTL_MS = 60000;

const createReferenceDataCache = ({ ttlMs = DEFAULT_REFERENCE_DATA_CACHE_TTL_MS } = {}) => ({
  ttlMs,
  expiresAt: 0,
  value: null,
  promise: null
});

const clearReferenceDataCache = (cache) => {
  if (!cache) return;

  cache.expiresAt = 0;
  cache.value = null;
  cache.promise = null;
};

const loadWithReferenceCache = async (cache, loader) => {
  if (!cache || typeof loader !== 'function') {
    throw new Error('Reference cache and loader are required');
  }

  const now = Date.now();
  if (cache.value !== null && cache.expiresAt > now) {
    return cache.value;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = Promise.resolve()
    .then(() => loader())
    .then((value) => {
      cache.value = value;
      cache.expiresAt = Date.now() + Math.max(0, Number(cache.ttlMs) || 0);
      cache.promise = null;
      return value;
    })
    .catch((error) => {
      cache.promise = null;
      throw error;
    });

  return cache.promise;
};

module.exports = {
  DEFAULT_REFERENCE_DATA_CACHE_TTL_MS,
  createReferenceDataCache,
  loadWithReferenceCache,
  clearReferenceDataCache
};
