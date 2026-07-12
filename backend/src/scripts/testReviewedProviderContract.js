const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const providerDir = path.join(repoRoot, 'src/services/lotteryProvider');
const fixtureDir = path.join(providerDir, 'fixtures/reviewed-provider');
const docsPath = path.join(workspaceRoot, 'docs/lottery-providers/reviewed-provider.md');

const { LotteryProviderError } = require('../services/lotteryProvider/providerError');
const { ReviewedProviderClient, __test: clientTest } = require('../services/lotteryProvider/reviewedProviderClient');
const { ReviewedProviderLotteryProvider } = require('../services/lotteryProvider/reviewedProviderLotteryProvider');
const mapper = require('../services/lotteryProvider/reviewedProviderMapper');
const {
  PROVIDER_CODE,
  CONTRACT_STATUS,
  getMissingContractItems
} = require('../services/lotteryProvider/reviewedProviderContract');
const { SUPPORTED_PROVIDERS, assertSupportedProvider, createLotteryProvider } = require('../services/lotteryProvider/providerFactory');

const TEST_SECRET = 'test-api-key-that-must-not-leak';
const SECRET_PATTERN = /secret|token|password|Authorization|Bearer|test-api-key|localhost|127\.0\.0\.1|Location|raw-secret-id/i;

const assertProviderError = async (fn, code, label) => {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof LotteryProviderError, `${label} should throw LotteryProviderError`);
  assert.strictEqual(thrown.code, code, `${label} should use controlled code ${code}`);
  assert(!SECRET_PATTERN.test(thrown.message), `${label} should not leak secrets, raw IDs, or redirect URLs`);
  return thrown;
};

const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));

const testContract = (overrides = {}) => ({
  providerCode: PROVIDER_CODE,
  endpoints: {
    status: '/test/status',
    ...(overrides.endpoints || {})
  },
  allowedQueryKeys: {
    status: ['sampleId'],
    ...(overrides.allowedQueryKeys || {})
  }
});

const makeTransport = (handler) => {
  const calls = [];
  return {
    calls,
    transport: {
      request: async (config) => {
        calls.push(config);
        return handler(config, calls.length);
      }
    }
  };
};

const makeClient = ({ handler, contract = testContract(), maxResponseBytes, timeoutMs = 4321 } = {}) => {
  const { calls, transport } = makeTransport(handler || (() => ({ status: 200, data: readFixture('provider-status.success.json') })));
  return {
    calls,
    client: new ReviewedProviderClient({
      baseUrl: 'https://provider.example.invalid/root/',
      apiKey: TEST_SECRET,
      networkEnabled: true,
      timeoutMs,
      transport,
      contract,
      maxResponseBytes
    })
  };
};

const assertFixtureInventory = () => {
  const expected = [
    'provider-status.success.json',
    'lotteries.valid.json',
    'rounds.valid.json',
    'round.valid.json',
    'results.pending.json',
    'results.published.json',
    'error.unauthorized.json',
    'error.rate-limit.json',
    'error.unavailable.json',
    'malformed.json',
    'unknown-status.json',
    'missing-required-field.json',
    'duplicate-ids.json',
    'invalid-date-timezone.json',
    'invalid-result-digit-length.json',
    'numeric-result.json',
    'oversized-payload.simulation.json'
  ];

  const actual = new Set(fs.readdirSync(fixtureDir).filter((file) => file.endsWith('.json')));
  for (const name of expected) {
    assert(actual.has(name), `missing reviewed-provider fixture ${name}`);
  }
};

const assertFixturesAreSanitized = () => {
  const forbiddenKey = /authorization|api.?key|token|secret|password|client.?secret|signature|private.?key/i;
  const allowedMetadataKeys = new Set(['containsSecrets']);
  const forbiddenValue = /Bearer\s+|sk-|password|token|-----BEGIN|mongodb\+srv|@/i;

  for (const file of fs.readdirSync(fixtureDir).filter((name) => name.endsWith('.json'))) {
    const raw = fs.readFileSync(path.join(fixtureDir, file), 'utf8');
    assert(!forbiddenValue.test(raw), `${file} should not contain secret-like values`);
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed._metadata?.containsSecrets, false, `${file} must declare no secrets`);
    assert.strictEqual(parsed._metadata?.containsCustomerData, false, `${file} must declare no customer data`);

    const walk = (value, trail = file) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${trail}[${index}]`));
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, nested] of Object.entries(value)) {
        assert(allowedMetadataKeys.has(key) || !forbiddenKey.test(key), `${trail}.${key} should not use secret-like keys`);
        walk(nested, `${trail}.${key}`);
      }
    };
    walk(parsed);
  }
};

const assertDocsDeclareUnconfirmedMapping = () => {
  const content = fs.readFileSync(docsPath, 'utf8');
  for (const required of [
    'Status: unconfirmed contract shell',
    'No official API documentation',
    'Do not invent an authentication scheme',
    'Unconfirmed - not mapped',
    'LOTTERY_REAL_NETWORK_ENABLED=false',
    'No POST/PUT/PATCH/DELETE provider calls are allowed',
    'Do not merge this placeholder name as production mapping',
    'Redirect responses are blocked',
    'Query allowlists are empty until provider docs confirm request parameters'
  ]) {
    assert(content.includes(required), `provider docs should include: ${required}`);
  }
};

const assertMappingStaysUnconfirmed = () => {
  const fixtures = {
    status: readFixture('provider-status.success.json'),
    lotteries: readFixture('lotteries.valid.json'),
    rounds: readFixture('rounds.valid.json'),
    round: readFixture('round.valid.json'),
    pendingResults: readFixture('results.pending.json'),
    publishedResults: readFixture('results.published.json'),
    malformed: readFixture('malformed.json')
  };

  const cases = [
    ['status', () => mapper.mapProviderStatus(fixtures.status)],
    ['lotteries', () => mapper.mapLotteries(fixtures.lotteries)],
    ['rounds', () => mapper.mapRounds(fixtures.rounds)],
    ['round detail', () => mapper.mapRound(fixtures.round)],
    ['pending results', () => mapper.mapResults(fixtures.pendingResults)],
    ['published results', () => mapper.mapResults(fixtures.publishedResults)],
    ['malformed placeholder', () => mapper.mapLotteries(fixtures.malformed)]
  ];

  for (const [label, fn] of cases) {
    assert.throws(
      fn,
      (error) => error instanceof LotteryProviderError && error.code === 'LOTTERY_PROVIDER_MAPPING_INVALID',
      `${label} should remain unmapped until provider evidence is supplied`
    );
  }

  const review = mapper.getMappingReview();
  assert.strictEqual(review.provider, PROVIDER_CODE);
  assert.strictEqual(review.status, CONTRACT_STATUS);
  assert.deepStrictEqual(review.confirmedMappings, []);
  assert(review.unconfirmedMappings.length >= 5, 'mapping review should list unconfirmed mappings');
  assert(getMissingContractItems().length >= 10, 'contract should list missing evidence');
};

const assertClientNetworkGate = async () => {
  let calls = 0;
  const transport = {
    request: async () => {
      calls += 1;
      return { status: 200, data: {} };
    }
  };

  const disabledClient = new ReviewedProviderClient({
    baseUrl: 'https://provider.example.invalid',
    apiKey: TEST_SECRET,
    networkEnabled: false,
    transport
  });

  await assertProviderError(
    () => disabledClient.get('status'),
    'LOTTERY_PROVIDER_NETWORK_DISABLED',
    'network disabled client'
  );
  assert.strictEqual(calls, 0, 'disabled network must not call transport');
  assert.deepStrictEqual(disabledClient.buildHeaders(), {}, 'auth headers must remain empty until provider docs confirm the scheme');
  assert.deepStrictEqual(disabledClient.safeSummary(), {
    provider: PROVIDER_CODE,
    baseUrlConfigured: true,
    apiKeyConfigured: true,
    networkEnabled: false,
    timeoutMs: 5000
  });
  assert(!Object.prototype.hasOwnProperty.call(disabledClient.safeSummary(), 'apiKeyPreview'), 'safe summary must not include any API key preview');

  const enabledClient = new ReviewedProviderClient({
    baseUrl: 'https://provider.example.invalid',
    apiKey: TEST_SECRET,
    networkEnabled: true,
    transport
  });

  await assertProviderError(
    () => enabledClient.get('status'),
    'LOTTERY_PROVIDER_NOT_CONFIGURED',
    'unconfirmed endpoint client'
  );
  assert.strictEqual(calls, 0, 'unconfirmed endpoint must not call transport');
};

const assertFakeTransportSuccess = async () => {
  const fixture = readFixture('provider-status.success.json');
  const { client, calls } = makeClient({
    handler: () => ({ status: 200, data: fixture })
  });

  const data = await client.get('status', { query: { sampleId: 'abc-123' } });
  assert.deepStrictEqual(data, fixture, '200 response should return fixture payload');
  assert.strictEqual(calls.length, 1, 'transport should be called once');
  assert.strictEqual(calls[0].method, 'GET');
  assert.strictEqual(calls[0].url, 'https://provider.example.invalid/test/status');
  assert.deepStrictEqual(calls[0].params, { sampleId: 'abc-123' });
  assert.deepStrictEqual(calls[0].headers, {});
  assert.strictEqual(calls[0].timeout, 4321);
  assert.strictEqual(calls[0].maxRedirects, 0);
  assert.strictEqual(calls[0].maxContentLength, clientTest.DEFAULT_MAX_RESPONSE_BYTES);
  assert.strictEqual(calls[0].maxBodyLength, clientTest.DEFAULT_MAX_RESPONSE_BYTES);

  const noContent = makeClient({ handler: () => ({ status: 204, data: null }) });
  assert.strictEqual(await noContent.client.get('status'), null, '204 response should be accepted by chosen policy');
  assert.strictEqual(noContent.calls.length, 1, '204 transport should be called once');
};

const assertRedirectAndStatusMapping = async () => {
  for (const status of [301, 302, 307, 308]) {
    const { client, calls } = makeClient({
      handler: () => ({
        status,
        headers: { location: 'http://127.0.0.1/private' },
        data: { message: 'redirect' }
      })
    });
    await assertProviderError(
      () => client.get('status'),
      'LOTTERY_PROVIDER_REDIRECT_BLOCKED',
      `${status} redirect`
    );
    assert.strictEqual(calls.length, 1, `${status} redirect should not be followed`);
    assert.strictEqual(calls[0].maxRedirects, 0, `${status} redirect should keep maxRedirects 0`);
  }

  const statusCases = [
    [400, 'LOTTERY_PROVIDER_ERROR', readFixture('malformed.json')],
    [401, 'LOTTERY_PROVIDER_UNAUTHORIZED', readFixture('error.unauthorized.json')],
    [403, 'LOTTERY_PROVIDER_UNAUTHORIZED', readFixture('error.unauthorized.json')],
    [429, 'LOTTERY_PROVIDER_RATE_LIMITED', readFixture('error.rate-limit.json')],
    [500, 'LOTTERY_PROVIDER_UNAVAILABLE', readFixture('error.unavailable.json')],
    [502, 'LOTTERY_PROVIDER_UNAVAILABLE', readFixture('error.unavailable.json')],
    [503, 'LOTTERY_PROVIDER_UNAVAILABLE', readFixture('error.unavailable.json')],
    [504, 'LOTTERY_PROVIDER_UNAVAILABLE', readFixture('error.unavailable.json')]
  ];

  for (const [status, code, data] of statusCases) {
    const { client, calls } = makeClient({ handler: () => ({ status, data }) });
    await assertProviderError(() => client.get('status'), code, `HTTP ${status}`);
    assert.strictEqual(calls.length, 1, `HTTP ${status} should call transport once`);
  }
};

const assertTransportErrorsAreControlled = async () => {
  const timeout = makeClient({
    handler: () => {
      const error = new Error(`timeout ${TEST_SECRET}`);
      error.code = 'ECONNABORTED';
      throw error;
    }
  });
  await assertProviderError(() => timeout.client.get('status'), 'LOTTERY_PROVIDER_TIMEOUT', 'transport timeout');

  const unavailable = makeClient({
    handler: () => {
      throw new Error(`boom ${TEST_SECRET}`);
    }
  });
  await assertProviderError(() => unavailable.client.get('status'), 'LOTTERY_PROVIDER_UNAVAILABLE', 'unknown transport error');
};

const assertResponseSizeLimit = async () => {
  const smallPayload = { ok: true };
  const smallLimit = Buffer.byteLength(JSON.stringify(smallPayload), 'utf8') + 1;
  const small = makeClient({
    maxResponseBytes: smallLimit,
    handler: () => ({ status: 200, data: smallPayload })
  });
  assert.deepStrictEqual(await small.client.get('status'), smallPayload, 'payload below serialized limit should pass');

  const oversizedFixture = readFixture('oversized-payload.simulation.json');
  const oversizedPayload = {
    ...oversizedFixture,
    items: Array.from({ length: 16 }, (_, index) => ({ index, text: 'x'.repeat(32) }))
  };
  const oversized = makeClient({
    maxResponseBytes: 128,
    handler: () => ({ status: 200, data: oversizedPayload })
  });
  await assertProviderError(
    () => oversized.client.get('status'),
    'LOTTERY_PROVIDER_RESPONSE_TOO_LARGE',
    'serialized oversized payload'
  );
  assert.strictEqual(oversized.calls.length, 1, 'oversized payload simulation should use fake transport once');
};

const assertEndpointPathGuard = async () => {
  const allowedStatus = new ReviewedProviderClient({
    baseUrl: 'https://provider.example.invalid/api/',
    networkEnabled: true,
    contract: testContract({ endpoints: { status: '/status' } })
  });
  assert.strictEqual(allowedStatus.buildUrl('status'), 'https://provider.example.invalid/status');

  const allowedNested = new ReviewedProviderClient({
    baseUrl: 'https://provider.example.invalid/api/',
    networkEnabled: true,
    contract: testContract({ endpoints: { status: '/api/v1/status' } })
  });
  assert.strictEqual(allowedNested.buildUrl('status'), 'https://provider.example.invalid/api/v1/status');

  const invalidEndpointPaths = [
    'status',
    './status',
    '../status',
    '/api/../admin',
    '/%2e%2e/admin',
    '/%2e%2e%2fadmin',
    '/%2e%2e%5cadmin',
    '/%252e%252e/admin',
    '/status?sampleId=bypass',
    '/status?mode=test',
    '/status#fragment',
    'https://evil.example/status',
    '//evil.example/status',
    'https://user:pass@provider.example.invalid/status',
    '/bad\\path',
    ' /status',
    '/status ',
    "/status\n",
    "\r/status",
    "/status\t",
    "/status\r\nnext",
    '/status\u0000next',
    ''
  ];

  for (const pathValue of invalidEndpointPaths) {
    const { client, calls } = makeClient({
      contract: testContract({ endpoints: { status: pathValue } }),
      handler: () => ({ status: 200, data: { ok: true } })
    });
    const error = await assertProviderError(
      () => client.get('status', { query: { sampleId: 'abc-123' } }),
      'LOTTERY_PROVIDER_NOT_CONFIGURED',
      'invalid endpoint path'
    );
    assert.strictEqual(calls.length, 0, 'invalid endpoint must fail before transport');
    if (pathValue) {
      assert(!error.message.includes(pathValue), 'endpoint error must not include raw endpoint path');
    }
  }

  const bypass = makeClient({
    contract: testContract({ endpoints: { status: '/status?sampleId=bypass' }, allowedQueryKeys: { status: ['sampleId'] } }),
    handler: () => ({ status: 200, data: { ok: true } })
  });
  const bypassError = await assertProviderError(
    () => bypass.client.get('status', { query: { sampleId: 'abc-123' } }),
    'LOTTERY_PROVIDER_NOT_CONFIGURED',
    'endpoint embedded query bypass'
  );
  assert.strictEqual(bypass.calls.length, 0, 'endpoint embedded query must not call transport');
  assert(!bypassError.message.includes('sampleId=bypass'), 'endpoint embedded query must not appear in error');
};
const assertQueryAllowlist = async () => {
  const validQueries = [
    [{ sampleId: 'abc-123' }, { sampleId: 'abc-123' }],
    [{ sampleId: '001' }, { sampleId: '001' }],
    [{ sampleId: 'round_2026-01' }, { sampleId: 'round_2026-01' }],
    [{ sampleId: 123 }, { sampleId: '123' }],
    [{ sampleId: undefined }, {}],
    [{ sampleId: null }, {}],
    [{ sampleId: '' }, {}]
  ];

  for (const [query, expected] of validQueries) {
    const allowed = makeClient({ handler: () => ({ status: 200, data: { ok: true } }) });
    assert.deepStrictEqual(await allowed.client.get('status', { query }), { ok: true });
    assert.deepStrictEqual(allowed.calls[0].params, expected);
  }

  const productionLike = makeClient({
    contract: testContract({ allowedQueryKeys: { status: [] } }),
    handler: () => ({ status: 200, data: { ok: true } })
  });
  await assertProviderError(
    () => productionLike.client.get('status', { query: { sampleId: 'safe-id' } }),
    'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
    'default empty query allowlist'
  );
  assert.strictEqual(productionLike.calls.length, 0, 'non-allowlisted query must fail before transport');

  const invalidQueries = [
    { unknown: 'value' },
    { sampleId: ['abc'] },
    { sampleId: { id: 'abc' } },
    { sampleId: () => 'abc' },
    { sampleId: Symbol('abc') },
    { sampleId: true },
    { sampleId: false },
    { sampleId: Number.NaN },
    { sampleId: Number.POSITIVE_INFINITY },
    { sampleId: 'https://evil.example/id' },
    { sampleId: '//evil.example/id' },
    { sampleId: '/internal/path' },
    { sampleId: 'abc/def' },
    { sampleId: '../private' },
    { sampleId: './private' },
    { sampleId: 'bad\\path' },
    { sampleId: '?mode=test' },
    { sampleId: '#fragment' },
    { sampleId: ' abc-123 ' },
    { sampleId: '\tabc' },
    { sampleId: 'abc\n' },
    { sampleId: 'abc\r\n' },
    { sampleId: 'line\rbreak' },
    { sampleId: 'line\nbreak' },
    { sampleId: 'null\u0000byte' },
    { sampleId: 'delete\u007Fchar' },
    { sampleId: 'control\u001Fchar' },
    { sampleId: 'x'.repeat(clientTest.MAX_QUERY_VALUE_LENGTH + 1) }
  ];

  for (const query of invalidQueries) {
    const { client, calls } = makeClient({ handler: () => ({ status: 200, data: { ok: true } }) });
    const error = await assertProviderError(
      () => client.get('status', { query }),
      'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
      'invalid query allowlist value'
    );
    assert.strictEqual(calls.length, 0, 'invalid query should fail before transport');
    for (const value of Object.values(query)) {
      if (typeof value === 'string') {
        assert(!error.message.includes(value), 'query error must not include raw query value');
      }
    }
  }
};
const assertRequestMappingFailsClosed = async () => {
  let calls = 0;
  const client = {
    get: async () => {
      calls += 1;
      return {};
    }
  };
  const provider = new ReviewedProviderLotteryProvider({ client });

  await assertProviderError(
    () => provider.listRounds({ lotteryExternalId: 'raw-secret-id' }),
    'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
    'listRounds unconfirmed request mapping'
  );
  await assertProviderError(
    () => provider.getRound('raw-secret-id'),
    'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
    'getRound unconfirmed request mapping'
  );
  await assertProviderError(
    () => provider.getResults({ roundExternalId: 'raw-secret-id' }),
    'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
    'getResults unconfirmed request mapping'
  );
  assert.strictEqual(calls, 0, 'unconfirmed provider request mapping must not call client');
};

const assertProviderFactoryPolicy = async () => {
  assert(SUPPORTED_PROVIDERS.has(PROVIDER_CODE), 'factory should register reviewed-provider explicitly');
  assert.strictEqual(assertSupportedProvider(PROVIDER_CODE), PROVIDER_CODE);

  const provider = createLotteryProvider({
    provider: PROVIDER_CODE,
    baseUrl: 'https://provider.example.invalid',
    apiKey: TEST_SECRET,
    networkEnabled: false
  });
  assert(provider instanceof ReviewedProviderLotteryProvider, 'factory should construct reviewed provider');
  assert.strictEqual(provider.name, PROVIDER_CODE);

  await assertProviderError(
    () => provider.getProviderStatus(),
    'LOTTERY_PROVIDER_NETWORK_DISABLED',
    'reviewed provider selected with network disabled'
  );

  assert.throws(
    () => createLotteryProvider({ provider: 'real-provider' }),
    /Unknown lottery provider/,
    'generic real-provider should remain unsupported'
  );
};

const assertEnvPolicy = () => {
  const envPath = require.resolve('../config/env');
  const originalEnv = { ...process.env };
  const restoreEnv = () => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    delete require.cache[envPath];
  };
  const loadConfig = (updates = {}) => {
    restoreEnv();
    Object.assign(process.env, {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/agent-lottery-test',
      JWT_SECRET: 'test-jwt-secret-value-at-least-32-chars',
      FRONTEND_URL: 'https://app.example.invalid',
      AUTO_SEED_ADMIN: 'false',
      AUTO_SEED_CATALOG: 'false',
      DEFAULT_ADMIN_USERNAME: 'admin',
      DEFAULT_ADMIN_PASSWORD: 'not-the-development-default-password',
      CRON_SYNC_TOKEN: 'test-cron-secret-value-at-least-32-chars',
      AUTO_SYNC_RESULTS: 'false'
    });
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    delete require.cache[envPath];
    return require(envPath);
  };

  try {
    const devConfig = loadConfig({ NODE_ENV: 'development', LOTTERY_PROVIDER: undefined });
    assert.strictEqual(devConfig.lotteryProvider, 'mock', 'development unset provider should still default to mock');
    assert.strictEqual(devConfig.lotteryRealNetworkEnabled, false, 'real network should default false');

    const reviewedDisabled = loadConfig({ NODE_ENV: 'production', LOTTERY_PROVIDER: PROVIDER_CODE, LOTTERY_REAL_NETWORK_ENABLED: 'false' });
    assert.strictEqual(reviewedDisabled.lotteryProvider, PROVIDER_CODE);
    assert.strictEqual(reviewedDisabled.lotteryRealNetworkEnabled, false);
    reviewedDisabled.validateEnv();

    const reviewedEnabled = loadConfig({ NODE_ENV: 'production', LOTTERY_PROVIDER: PROVIDER_CODE, LOTTERY_REAL_NETWORK_ENABLED: 'true' });
    assert.throws(
      () => reviewedEnabled.validateEnv(),
      /cannot be true for reviewed-provider/,
      'reviewed-provider live network must fail until contract is confirmed'
    );
  } finally {
    restoreEnv();
  }
};

const assertEnvTemplates = () => {
  for (const relativePath of ['.env.docker.example', '.env.production.example', 'backend/.env.example']) {
    const content = fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
    assert(content.includes('LOTTERY_REAL_NETWORK_ENABLED=false'), `${relativePath} should default real network disabled`);
  }
};

const assertBoundaryGuards = () => {
  const providerFiles = fs.readdirSync(providerDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => [file, fs.readFileSync(path.join(providerDir, file), 'utf8')]);
  const combinedProviderSource = providerFiles.map(([, source]) => source).join('\n');

  for (const forbidden of [
    'mongoose',
    '../models',
    'CreditLedgerEntry',
    'walletService',
    'agentFinancialService',
    'settleRound',
    'applyRoundSettlement',
    'createMemberSlip',
    'heldStakeBalance',
    '.save(',
    '.insert',
    '.update',
    '.delete',
    'findOneAndUpdate',
    'debit',
    'credit'
  ]) {
    assert.strictEqual(
      combinedProviderSource.includes(forbidden),
      false,
      `lottery provider module must not reference boundary token: ${forbidden}`
    );
  }

  assert.strictEqual(/console\.(log|error|warn).*LOTTERY_API_KEY/.test(combinedProviderSource), false, 'provider module must not log API keys');
  assert.strictEqual(/req\.query\.url|req\.body\.url/.test(combinedProviderSource), false, 'provider module must not accept arbitrary URLs from requests');
};

(async () => {
  assertFixtureInventory();
  assertFixturesAreSanitized();
  assertDocsDeclareUnconfirmedMapping();
  assertMappingStaysUnconfirmed();
  await assertClientNetworkGate();
  await assertFakeTransportSuccess();
  await assertRedirectAndStatusMapping();
  await assertTransportErrorsAreControlled();
  await assertResponseSizeLimit();
  await assertEndpointPathGuard();
  await assertQueryAllowlist();
  await assertRequestMappingFailsClosed();
  await assertProviderFactoryPolicy();
  assertEnvPolicy();
  assertEnvTemplates();
  assertBoundaryGuards();

  console.log('testReviewedProviderContract: ok');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
