const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '2';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';

const {
  loginRateLimit,
  resetLoginRateLimit,
  __test: rateLimitTest
} = require('../middleware/loginRateLimit');
const {
  canAuthenticateAccount,
  getAccountAccessMessage,
  isActiveAccountStatus
} = require('../utils/accountAccess');
const {
  DEFAULT_MAX_SEARCH_LENGTH,
  buildLiteralSearchRegex,
  toSearchText
} = require('../utils/search');
const {
  __test: {
    buildAgentMembersFilter
  }
} = require('../services/memberManagementService');

const repoRoot = path.resolve(__dirname, '..', '..');

assert.strictEqual(isActiveAccountStatus('active'), true);
assert.strictEqual(isActiveAccountStatus(' ACTIVE '), true);
assert.strictEqual(isActiveAccountStatus('suspended'), false);
assert.strictEqual(isActiveAccountStatus('inactive'), false);
assert.strictEqual(isActiveAccountStatus(undefined), true, 'missing legacy status should not lock old accounts out');

assert.strictEqual(canAuthenticateAccount({ isActive: true, status: 'active' }), true);
assert.strictEqual(canAuthenticateAccount({ isActive: false, status: 'active' }), false);
assert.strictEqual(canAuthenticateAccount({ isActive: true, status: 'suspended' }), false);
assert.strictEqual(getAccountAccessMessage({ isActive: true, status: 'suspended' }), 'Account is not active.');

const literalRegex = buildLiteralSearchRegex('a[b');
assert.ok(literalRegex.test('a[b'), 'search regex should match literal special characters');
assert.strictEqual(literalRegex.test('ab'), false, 'search regex should not treat special characters as regex syntax');

assert.strictEqual(
  toSearchText('x'.repeat(DEFAULT_MAX_SEARCH_LENGTH + 10)).length,
  DEFAULT_MAX_SEARCH_LENGTH,
  'search text should be bounded before building regex filters'
);

const memberFilter = buildAgentMembersFilter({
  agentId: 'agent-1',
  search: 'a[b',
  status: 'active'
});
assert.strictEqual(memberFilter.$and[0].role, 'customer');
assert.ok(
  memberFilter.$and[1].$or[0].name.test('a[b'),
  'agent member search should use escaped literal regex'
);
assert.strictEqual(
  memberFilter.$and[1].$or[0].name.test('ab'),
  false,
  'agent member search should not evaluate raw regex syntax'
);

const makeReq = () => ({ body: { username: 'Admin' }, ip: '127.0.0.1', socket: {} });
const makeRes = () => {
  const res = { statusCode: 200, headers: {}, body: null };
  res.set = (name, value) => { res.headers[name] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
rateLimitTest.attemptsByKey.clear();
const firstReq = makeReq();
loginRateLimit(firstReq, makeRes(), () => {});
loginRateLimit(makeReq(), makeRes(), () => {});
const blockedRes = makeRes();
loginRateLimit(makeReq(), blockedRes, () => { throw new Error('blocked request should not continue'); });
assert.strictEqual(blockedRes.statusCode, 429, 'login attempts should be rate limited');
assert.strictEqual(blockedRes.headers['Retry-After'] !== undefined, true, 'rate limit should return Retry-After');
resetLoginRateLimit(firstReq);
assert.strictEqual(rateLimitTest.attemptsByKey.size, 0, 'successful login should clear login bucket');

const authRoutesSource = fs.readFileSync(path.join(repoRoot, 'src/routes/authRoutes.js'), 'utf8');
assert.ok(authRoutesSource.includes("router.post('/login', loginRateLimit"), 'login route should install rate limiter');
assert.ok(
  authRoutesSource.indexOf('const isMatch = await user.comparePassword(password);') < authRoutesSource.indexOf('if (!canAuthenticateAccount(user))'),
  'login should verify the password before exposing account status'
);

const originalEnv = { ...process.env };
try {
  process.env.NODE_ENV = 'production';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test';
  process.env.JWT_SECRET = 'a-production-secret-long-enough';
  process.env.FRONTEND_URL = 'https://example.com';
  process.env.AUTO_SEED_ADMIN = 'false';
  process.env.AUTO_SYNC_RESULTS = 'false';
  process.env.LOTTERY_PROVIDER = 'mock';
  process.env.LOG_FORMAT = 'combined';
  process.env.RESULT_SYNC_INTERVAL_MS = '300000';
  process.env.RESULT_SYNC_STARTUP_DELAY_MS = '60000';
  process.env.RETENTION_CLEANUP_INTERVAL_MS = '86400000';
  process.env.RETENTION_CLEANUP_STARTUP_DELAY_MS = '120000';
  process.env.RETENTION_KEEP_PREVIOUS_MONTHS = '1';
  delete process.env.CRON_SYNC_TOKEN;
  delete require.cache[require.resolve('../config/env')];
  assert.throws(
    () => require('../config/env').validateEnv(),
    /CRON_SYNC_TOKEN is required in production when AUTO_SYNC_RESULTS=false/
  );
  process.env.CRON_SYNC_TOKEN = 'cron-token-long-enough-value';
  process.env.BACKEND_HOST = '127.0.0.1';
  delete require.cache[require.resolve('../config/env')];
  const validEnv = require('../config/env');
  assert.strictEqual(validEnv.backendHost, '127.0.0.1', 'BACKEND_HOST should be exported for server bind');
  assert.doesNotThrow(() => validEnv.validateEnv());

  for (const host of ['::1', 'backend.internal']) {
    process.env.BACKEND_HOST = host;
    delete require.cache[require.resolve('../config/env')];
    assert.doesNotThrow(() => require('../config/env').validateEnv());
  }

  process.env.BACKEND_HOST = 'http://127.0.0.1';
  delete require.cache[require.resolve('../config/env')];
  assert.throws(
    () => require('../config/env').validateEnv(),
    /BACKEND_HOST must be a bind host only/
  );

  process.env.BACKEND_HOST = ' 127.0.0.1';
  delete require.cache[require.resolve('../config/env')];
  assert.throws(
    () => require('../config/env').validateEnv(),
    /BACKEND_HOST must be a bind host only/
  );
} finally {
  process.env = originalEnv;
  delete require.cache[require.resolve('../config/env')];
}

const backendPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
for (const name of ['legacy:cleanup:migrate', 'legacy:cleanup:archive', 'legacy:cleanup:purge']) {
  assert.strictEqual(backendPackage.scripts[name].includes('--yes'), false, name + ' must require explicit confirmation');
}

console.log('testAuthAndSearchGuards: ok');
