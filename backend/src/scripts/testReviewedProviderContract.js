const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const providerDir = path.join(repoRoot, 'src/services/lotteryProvider');
const fixtureDir = path.join(providerDir, 'fixtures/reviewed-provider');
const docsPath = path.join(workspaceRoot, 'docs/lottery-providers/reviewed-provider.md');

const { LotteryProviderError } = require('../services/lotteryProvider/providerError');
const { ReviewedProviderClient } = require('../services/lotteryProvider/reviewedProviderClient');
const { ReviewedProviderLotteryProvider } = require('../services/lotteryProvider/reviewedProviderLotteryProvider');
const mapper = require('../services/lotteryProvider/reviewedProviderMapper');
const { PROVIDER_CODE, CONTRACT_STATUS, getMissingContractItems } = require('../services/lotteryProvider/reviewedProviderContract');
const { SUPPORTED_PROVIDERS, assertSupportedProvider, createLotteryProvider } = require('../services/lotteryProvider/providerFactory');

const assertProviderError = async (fn, code, label) => {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof LotteryProviderError, `${label} should throw LotteryProviderError`);
  assert.strictEqual(thrown.code, code, `${label} should use controlled code ${code}`);
  assert(!/secret|token|password|Authorization|Bearer test-api-key/i.test(thrown.message), `${label} should not leak secrets`);
};

const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));

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
    'Do not merge this placeholder name as production mapping'
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
    publishedResults: readFixture('results.published.json')
  };

  const cases = [
    ['status', () => mapper.mapProviderStatus(fixtures.status)],
    ['lotteries', () => mapper.mapLotteries(fixtures.lotteries)],
    ['rounds', () => mapper.mapRounds(fixtures.rounds)],
    ['round detail', () => mapper.mapRound(fixtures.round)],
    ['pending results', () => mapper.mapResults(fixtures.pendingResults)],
    ['published results', () => mapper.mapResults(fixtures.publishedResults)]
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
    apiKey: 'test-api-key-that-must-not-leak',
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
    apiKeyPreview: '[redacted]',
    networkEnabled: false,
    timeoutMs: 5000
  });

  const enabledClient = new ReviewedProviderClient({
    baseUrl: 'https://provider.example.invalid',
    apiKey: 'test-api-key-that-must-not-leak',
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

const assertProviderFactoryPolicy = async () => {
  assert(SUPPORTED_PROVIDERS.has(PROVIDER_CODE), 'factory should register reviewed-provider explicitly');
  assert.strictEqual(assertSupportedProvider(PROVIDER_CODE), PROVIDER_CODE);

  const provider = createLotteryProvider({
    provider: PROVIDER_CODE,
    baseUrl: 'https://provider.example.invalid',
    apiKey: 'test-api-key-that-must-not-leak',
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
  await assertProviderFactoryPolicy();
  assertEnvPolicy();
  assertEnvTemplates();
  assertBoundaryGuards();

  console.log('testReviewedProviderContract: ok');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
