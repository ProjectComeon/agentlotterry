import assert from 'node:assert/strict';
import { buildReadCacheKey, stableStringify } from '../src/utils/apiReadCache.js';

assert.equal(
  stableStringify({ b: 2, a: 1, empty: '', nope: undefined }),
  JSON.stringify({ a: 1, b: 2 }),
  'stableStringify should sort keys and drop empty values'
);

assert.equal(
  buildReadCacheKey({
    token: 'abc',
    url: '/admin/dashboard',
    params: { marketId: 'lao', roundDate: '2026-04-20' }
  }),
  'abc:/admin/dashboard:{"marketId":"lao","roundDate":"2026-04-20"}',
  'cache keys should be deterministic'
);

console.log('testApiReadCache passed');
