const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const providerDir = path.join(repoRoot, 'src/services/lotteryProvider');

const { LotteryProviderError } = require('../services/lotteryProvider/providerError');
const {
  validateLotteries,
  validateRounds,
  validateResults,
  __test: schemaTest
} = require('../services/lotteryProvider/schemas');
const { MockLotteryProvider, __test: mockTest } = require('../services/lotteryProvider/mockLotteryProvider');
const { assertSupportedProvider, createLotteryProvider } = require('../services/lotteryProvider/providerFactory');

const assertProviderError = async (fn, pattern, label) => {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof LotteryProviderError, `${label} should throw LotteryProviderError`);
  assert(pattern.test(thrown.message), `${label} should have safe expected message`);
};

const assertLotteryProviderError = (fn, pattern, label) => {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof LotteryProviderError, `${label} should throw LotteryProviderError`);
  assert(pattern.test(thrown.message), `${label} should have safe expected message`);
};

const restoreEnv = (env) => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
};

const withEnvConfig = (updates = {}, fn) => {
  const envPath = require.resolve('../config/env');
  const originalEnv = { ...process.env };
  const base = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/agent-lottery-test',
    JWT_SECRET: 'test-jwt-secret-value-at-least-32-chars',
    FRONTEND_URL: 'https://app.example.invalid',
    CRON_SYNC_TOKEN: 'test-cron-secret-value-at-least-32-chars',
    AUTO_SYNC_RESULTS: 'false',
    LOTTERY_API_BASE_URL: 'https://provider.example.invalid',
    LOTTERY_API_TIMEOUT_MS: '5000'
  };

  try {
    restoreEnv({ ...originalEnv, ...base });
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    delete require.cache[envPath];
    return fn(require(envPath));
  } finally {
    restoreEnv(originalEnv);
    delete require.cache[envPath];
  }
};

const assertEnvTemplatesAreOneKeyPerLine = () => {
  for (const relativePath of ['.env.docker.example', '.env.production.example', 'backend/.env.example']) {
    const fullPath = path.join(workspaceRoot, relativePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.includes('LOTTERY_API_TIMEOUT_MS=5000'), `${relativePath} must include lottery timeout on its own line`);
    assert(content.includes('AUTO_SYNC_RESULTS=false'), `${relativePath} must include auto sync flag on its own line`);
    assert.strictEqual(content.includes('5000AUTO_'), false, `${relativePath} must not join timeout and next key`);
    assert.strictEqual(content.includes('5000#'), false, `${relativePath} must not join timeout and comments`);

    content.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      assert(/^[A-Z][A-Z0-9_]*=.*/.test(trimmed), `${relativePath}:${index + 1} must be KEY=value`);
      const keyMatches = trimmed.match(/[A-Z][A-Z0-9_]*=/g) || [];
      assert.strictEqual(keyMatches.length, 1, `${relativePath}:${index + 1} must contain exactly one config key`);
    });
  }
};

const assertEnvironmentProviderPolicy = () => {
  withEnvConfig({ NODE_ENV: 'test', LOTTERY_PROVIDER: undefined }, (testConfig) => {
    assert.strictEqual(testConfig.lotteryProvider, 'mock', 'test env should default unset provider to mock');
    testConfig.validateEnv();
  });

  withEnvConfig({ NODE_ENV: 'development', LOTTERY_PROVIDER: undefined }, (devConfig) => {
    assert.strictEqual(devConfig.lotteryProvider, 'mock', 'development env should default unset provider to mock');
    devConfig.validateEnv();
  });

  withEnvConfig({ NODE_ENV: 'production', LOTTERY_PROVIDER: undefined }, (prodMissingProvider) => {
    assert.strictEqual(prodMissingProvider.lotteryProvider, '', 'production unset provider must not silently become mock');
    assert.throws(
      () => prodMissingProvider.validateEnv(),
      /LOTTERY_PROVIDER is required in production/,
      'production unset provider should fail validation'
    );
  });

  withEnvConfig({ NODE_ENV: 'production', LOTTERY_PROVIDER: 'mock' }, (prodExplicitMock) => {
    assert.strictEqual(prodExplicitMock.lotteryProvider, 'mock', 'production explicit mock should be preserved');
    prodExplicitMock.validateEnv();
  });

  withEnvConfig({ NODE_ENV: 'production', LOTTERY_PROVIDER: 'real-provider' }, (unknownProvider) => {
    assert.throws(
      () => unknownProvider.validateEnv(),
      /LOTTERY_PROVIDER "real-provider" is not supported/,
      'unknown provider should fail without falling back to mock'
    );
  });

  assert.throws(
    () => assertSupportedProvider(''),
    /not configured/,
    'empty provider should not fall back to mock in provider factory'
  );
};

const assertTimezoneValidation = () => {
  assert.strictEqual(schemaTest.normalizeTimezone('Asia/Bangkok'), 'Asia/Bangkok');
  assert.strictEqual(schemaTest.normalizeTimezone('UTC'), 'UTC');
  assertLotteryProviderError(
    () => schemaTest.normalizeTimezone('Not/A_Timezone'),
    /supported timezone/,
    'invalid timezone'
  );
  assertLotteryProviderError(
    () => schemaTest.normalizeTimezone('   '),
    /required/,
    'blank timezone'
  );
};

const assertExactResultNumberValidation = () => {
  const fixtures = mockTest.baseFixtures();
  const validNumbers = {
    ...fixtures.results[0].numbers,
    twoTop: '05',
    threeTop: '007',
    runTop: ['0']
  };
  const [validResult] = validateResults([{ ...fixtures.results[0], numbers: validNumbers }]);
  assert.strictEqual(validResult.numbers.twoTop, '05', 'twoTop should preserve leading zero');
  assert.strictEqual(validResult.numbers.threeTop, '007', 'threeTop should preserve leading zero');
  assert.deepStrictEqual(validResult.numbers.runTop, ['0'], 'runTop should preserve single digit string');

  for (const [field, value] of [
    ['twoTop', '5'],
    ['twoTop', '123'],
    ['threeTop', '12'],
    ['twoBottom', 'AA'],
    ['twoBottom', '-1'],
    ['threeBottom', '1.2']
  ]) {
    assert.throws(
      () => validateResults([{ ...fixtures.results[0], numbers: { ...fixtures.results[0].numbers, [field]: value } }]),
      /exactly|exceeds/,
      `${field}=${value} should be rejected`
    );
  }

  assert.throws(
    () => validateResults([{ ...fixtures.results[0], numbers: { ...fixtures.results[0].numbers, runTop: ['10'] } }]),
    /exactly|exceeds/,
    'runTop entries must be exactly one digit'
  );
  assert.throws(
    () => validateResults([{ ...fixtures.results[0], numbers: { ...fixtures.results[0].numbers, headline: 'x'.repeat(161) } }]),
    /exceeds 160/,
    'headline should be display-only text with a length limit'
  );
};

const assertProviderPreviewQueryValidation = () => {
  const adminRoutes = require('../routes/adminRoutes');
  const { parseProviderPreviewQuery } = adminRoutes.__test;
  const roundStatuses = new Set(['upcoming', 'open', 'closed', 'resulted']);
  const resultStatuses = new Set(['pending', 'published']);

  assert.deepStrictEqual(
    parseProviderPreviewQuery({ lotteryExternalId: 'mock-thai-government', status: 'open' }, { allowedStatuses: roundStatuses }),
    { lotteryExternalId: 'mock-thai-government', status: 'open' },
    'valid round query should pass through normalized'
  );
  assert.deepStrictEqual(
    parseProviderPreviewQuery({ lotteryExternalId: 'mock-thai-government', roundExternalId: 'mock-round-closed', status: 'published' }, { includeRoundExternalId: true, allowedStatuses: resultStatuses }),
    { lotteryExternalId: 'mock-thai-government', status: 'published', roundExternalId: 'mock-round-closed' },
    'valid result query should include round id'
  );

  for (const query of [
    { status: 'settled' },
    { status: ['open'] },
    { lotteryExternalId: { id: 'mock' } },
    { lotteryExternalId: 'x'.repeat(121) },
    { lotteryExternalId: 'https://provider.example.invalid/mock' },
    { roundExternalId: 'mock/round' }
  ]) {
    assert.throws(
      () => parseProviderPreviewQuery(query, { includeRoundExternalId: true, allowedStatuses: resultStatuses }),
      (error) => error.status === 400 && error.code === 'LOTTERY_PROVIDER_QUERY_INVALID',
      `invalid provider query should be controlled 400: ${JSON.stringify(query)}`
    );
  }
};

(async () => {
  assertEnvTemplatesAreOneKeyPerLine();
  assertEnvironmentProviderPolicy();
  assertTimezoneValidation();
  assertExactResultNumberValidation();
  assertProviderPreviewQueryValidation();

  const provider = new MockLotteryProvider();
  const status = await provider.getProviderStatus();
  assert.strictEqual(status.provider, 'mock');
  assert.strictEqual(status.status, 'ok');

  const lotteries = await provider.listLotteries();
  assert(lotteries.length >= 2, 'mock provider should expose lottery fixtures');
  assert(lotteries.every((lottery) => lottery.externalId && lottery.timezone), 'lotteries must be normalized');

  const rounds = await provider.listRounds();
  assert(rounds.some((round) => round.status === 'open'), 'mock provider should expose open rounds');
  assert(rounds.some((round) => round.status === 'closed'), 'mock provider should expose closed rounds');
  assert(rounds.every((round) => round.openAt.endsWith('Z') && round.closeAt.endsWith('Z')), 'round dates must be normalized ISO strings');

  const nearClosing = rounds.find((round) => round.externalId === 'mock-round-near-close');
  assert(nearClosing, 'mock provider should expose a near-closing round');

  const round = await provider.getRound('mock-round-open');
  assert.strictEqual(round.externalId, 'mock-round-open');

  const results = await provider.getResults();
  assert(results.length >= 1, 'mock provider should expose result fixtures');
  assert(results[0].numbers.twoBottom, 'result should include normalized numbers');

  const fixtures = mockTest.baseFixtures();
  assert.throws(
    () => validateLotteries([{ ...fixtures.lotteries[0], name: '' }]),
    /name is required/,
    'missing required provider fields should be rejected'
  );
  assert.throws(
    () => validateRounds([{ ...fixtures.rounds[0], openAt: '2026-07-11 12:00:00' }]),
    /explicit timezone/,
    'malformed provider dates should be rejected'
  );
  assert.throws(
    () => validateRounds([fixtures.rounds[0], { ...fixtures.rounds[1], externalId: fixtures.rounds[0].externalId }]),
    /duplicate externalId/,
    'duplicate external IDs should be rejected'
  );
  assert.throws(
    () => validateResults([{ ...fixtures.results[0], numbers: { firstPrize: 'ABC' } }]),
    /exactly 6 digits/,
    'invalid result numbers should be rejected'
  );

  await assertProviderError(
    () => new MockLotteryProvider({ scenario: 'timeout' }).listLotteries(),
    /timed out/,
    'timeout scenario'
  );
  await assertProviderError(
    () => new MockLotteryProvider({ scenario: 'unavailable' }).getResults(),
    /unavailable/,
    'unavailable scenario'
  );

  assert.throws(
    () => assertSupportedProvider('unknown'),
    /Unknown lottery provider/,
    'unknown provider should fail clearly'
  );
  assert.throws(
    () => createLotteryProvider({ provider: 'https://provider.example.invalid' }),
    /Unknown lottery provider/,
    'provider factory must not accept URL-like provider names'
  );

  const sourceByFile = Object.fromEntries(
    fs.readdirSync(providerDir)
      .filter((file) => file.endsWith('.js'))
      .map((file) => [file, fs.readFileSync(path.join(providerDir, file), 'utf8')])
  );
  const combinedProviderSource = Object.values(sourceByFile).join('\n');

  for (const forbidden of [
    'CreditLedgerEntry',
    'walletService',
    'agentFinancialService',
    'settleRound',
    'applyRoundSettlement',
    'createMemberSlip',
    'heldStakeBalance',
    'debit',
    'credit'
  ]) {
    assert.strictEqual(
      combinedProviderSource.includes(forbidden),
      false,
      `lottery provider module must not reference money flow token: ${forbidden}`
    );
  }

  assert.strictEqual(/LOTTERY_API_KEY.*console\./.test(combinedProviderSource), false, 'provider module must not log API keys');
  assert.strictEqual(/req\.query\.url|req\.body\.url/.test(combinedProviderSource), false, 'provider module must not accept arbitrary URLs from requests');
  assert.strictEqual(/axios|fetch\(|https\.request|http\.request/.test(sourceByFile.mockLotteryProvider || ''), false, 'mock provider must not use network');

  const adminRoutes = fs.readFileSync(path.join(repoRoot, 'src/routes/adminRoutes.js'), 'utf8');
  assert(adminRoutes.includes("router.get('/lottery-provider/status'"), 'admin provider status endpoint should exist');
  assert(adminRoutes.includes("router.get('/lottery-provider/preview/lotteries'"), 'admin provider lotteries endpoint should exist');
  assert(adminRoutes.includes("router.get('/lottery-provider/preview/rounds'"), 'admin provider rounds endpoint should exist');
  assert(adminRoutes.includes('parseProviderPreviewQuery(req.query'), 'admin preview endpoints must validate query before provider call');
  assert(adminRoutes.includes('LOTTERY_PROVIDER_QUERY_INVALID'), 'admin preview query errors must be controlled');
  assert(adminRoutes.indexOf("router.use(auth, authorize('admin'))") < adminRoutes.indexOf("router.get('/lottery-provider/status'"), 'provider preview endpoints must be behind admin auth middleware');

  const agentRoutes = fs.readFileSync(path.join(repoRoot, 'src/routes/agentRoutes.js'), 'utf8');
  const memberRoutes = fs.readFileSync(path.join(repoRoot, 'src/routes/memberRoutes.js'), 'utf8');
  assert.strictEqual(agentRoutes.includes('lottery-provider'), false, 'agent routes must not expose provider preview');
  assert.strictEqual(memberRoutes.includes('lottery-provider'), false, 'member routes must not expose provider preview');

  console.log('testLotteryProviderAdapter: ok');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
