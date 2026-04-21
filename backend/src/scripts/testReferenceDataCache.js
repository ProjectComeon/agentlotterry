const assert = require('assert');

const {
  DEFAULT_REFERENCE_DATA_CACHE_TTL_MS,
  createReferenceDataCache,
  loadWithReferenceCache,
  clearReferenceDataCache
} = require('../utils/referenceDataCache');

const run = async () => {
  assert.strictEqual(
    DEFAULT_REFERENCE_DATA_CACHE_TTL_MS,
    60000,
    'default reference-data cache TTL should be 60000ms'
  );

  const cache = createReferenceDataCache({ ttlMs: 50 });
  let loadCount = 0;

  const first = await loadWithReferenceCache(cache, async () => {
    loadCount += 1;
    return { value: loadCount };
  });

  const second = await loadWithReferenceCache(cache, async () => {
    loadCount += 1;
    return { value: loadCount };
  });

  assert.strictEqual(loadCount, 1, 'cached value should be reused inside TTL');
  assert.deepStrictEqual(second, first, 'cached object should be returned while warm');

  clearReferenceDataCache(cache);
  const third = await loadWithReferenceCache(cache, async () => {
    loadCount += 1;
    return { value: loadCount };
  });

  assert.strictEqual(loadCount, 2, 'clearing cache should force a reload');
  assert.notDeepStrictEqual(third, first, 'cleared cache should return a fresh value');

  console.log('testReferenceDataCache: ok');
};

run().catch((error) => {
  console.error('testReferenceDataCache: failed');
  console.error(error);
  process.exit(1);
});
