const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const providerDir = path.join(repoRoot, 'src/services/lotteryProvider');

const { LotteryProviderError } = require('../services/lotteryProvider/providerError');
const {
  validateLotteries,
  validateRounds,
  validateResults
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

(async () => {
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
    /invalid result number format/,
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
