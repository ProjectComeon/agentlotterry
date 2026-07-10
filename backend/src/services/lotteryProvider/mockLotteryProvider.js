const { LotteryProviderError } = require('./providerError');
const {
  validateProviderStatus,
  validateLotteries,
  validateRounds,
  validateResults
} = require('./schemas');

const nowIso = () => new Date().toISOString();

const baseFixtures = () => {
  const now = Date.now();
  const openAt = new Date(now - 60 * 60 * 1000).toISOString();
  const closeAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const nearCloseAt = new Date(now + 10 * 60 * 1000).toISOString();
  const resultAt = new Date(now + 3 * 60 * 60 * 1000).toISOString();
  const closedCloseAt = new Date(now - 30 * 60 * 1000).toISOString();
  const closedResultAt = new Date(now + 30 * 60 * 1000).toISOString();

  const lotteries = [
    {
      externalId: 'mock-thai-government',
      code: 'thai_government',
      name: 'Thai Government Lottery',
      label: 'Thai Government',
      type: 'government',
      status: 'active',
      timezone: 'Asia/Bangkok',
      provider: 'mock',
      supportedBetTypes: ['3top', '2top', '2bottom']
    },
    {
      externalId: 'mock-laos-vip',
      code: 'laos_vip',
      name: 'Laos VIP',
      label: 'Laos VIP',
      type: 'daily',
      status: 'active',
      timezone: 'Asia/Bangkok',
      provider: 'mock',
      supportedBetTypes: ['3top', '2top']
    }
  ];

  const rounds = [
    {
      externalId: 'mock-round-open',
      lotteryExternalId: 'mock-thai-government',
      code: '2026-07-11',
      displayName: 'Thai Government 2026-07-11',
      openAt,
      closeAt,
      resultAt,
      status: 'open',
      timezone: 'Asia/Bangkok'
    },
    {
      externalId: 'mock-round-near-close',
      lotteryExternalId: 'mock-laos-vip',
      code: '2026-07-11-evening',
      displayName: 'Laos VIP Evening',
      openAt,
      closeAt: nearCloseAt,
      resultAt,
      status: 'open',
      timezone: 'Asia/Bangkok'
    },
    {
      externalId: 'mock-round-closed',
      lotteryExternalId: 'mock-thai-government',
      code: '2026-07-10',
      displayName: 'Thai Government 2026-07-10',
      openAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      closeAt: closedCloseAt,
      resultAt: closedResultAt,
      status: 'closed',
      timezone: 'Asia/Bangkok'
    }
  ];

  const results = [
    {
      externalId: 'mock-result-closed',
      lotteryExternalId: 'mock-thai-government',
      roundExternalId: 'mock-round-closed',
      status: 'published',
      resultAt: new Date(now - 10 * 60 * 1000).toISOString(),
      timezone: 'Asia/Bangkok',
      numbers: {
        headline: '123456',
        firstPrize: '123456',
        threeTop: '456',
        twoTop: '56',
        twoBottom: '89',
        threeTopHits: ['456'],
        twoTopHits: ['56'],
        twoBottomHits: ['89'],
        runTop: ['4', '5', '6'],
        runBottom: ['8', '9']
      }
    }
  ];

  return { lotteries, rounds, results };
};

class MockLotteryProvider {
  constructor({ scenario = 'valid' } = {}) {
    this.name = 'mock';
    this.scenario = scenario;
  }

  async #guardScenario() {
    if (this.scenario === 'timeout') {
      throw new LotteryProviderError('Lottery provider timed out', {
        code: 'LOTTERY_PROVIDER_TIMEOUT',
        status: 504
      });
    }

    if (this.scenario === 'unavailable') {
      throw new LotteryProviderError('Lottery provider is unavailable', {
        code: 'LOTTERY_PROVIDER_UNAVAILABLE',
        status: 503
      });
    }
  }

  #fixtures() {
    const fixtures = baseFixtures();

    if (this.scenario === 'invalid_schema') {
      fixtures.lotteries[0] = { ...fixtures.lotteries[0], name: '' };
    }

    if (this.scenario === 'duplicate_id') {
      fixtures.rounds[1] = { ...fixtures.rounds[1], externalId: fixtures.rounds[0].externalId };
    }

    if (this.scenario === 'malformed_date') {
      fixtures.rounds[0] = { ...fixtures.rounds[0], openAt: '2026-07-11 12:00:00' };
    }

    return fixtures;
  }

  async getProviderStatus() {
    if (this.scenario === 'unavailable_status') {
      return validateProviderStatus({
        provider: this.name,
        status: 'unavailable',
        checkedAt: nowIso(),
        message: 'Mock provider unavailable'
      });
    }

    await this.#guardScenario();
    return validateProviderStatus({
      provider: this.name,
      status: 'ok',
      checkedAt: nowIso(),
      message: 'Mock provider ready'
    });
  }

  async listLotteries() {
    await this.#guardScenario();
    return validateLotteries(this.#fixtures().lotteries);
  }

  async listRounds(params = {}) {
    await this.#guardScenario();
    const { lotteryExternalId, status } = params;
    const rounds = this.#fixtures().rounds.filter((round) => {
      if (lotteryExternalId && round.lotteryExternalId !== lotteryExternalId) return false;
      if (status && round.status !== status) return false;
      return true;
    });
    return validateRounds(rounds);
  }

  async getRound(externalRoundId) {
    await this.#guardScenario();
    const roundId = String(externalRoundId || '').trim();
    const round = this.#fixtures().rounds.find((item) => item.externalId === roundId);
    if (!round) {
      throw new LotteryProviderError('Lottery provider round not found', {
        code: 'LOTTERY_PROVIDER_ROUND_NOT_FOUND',
        status: 404
      });
    }
    return validateRounds([round])[0];
  }

  async getResults(params = {}) {
    await this.#guardScenario();
    const { lotteryExternalId, roundExternalId, status } = params;
    const results = this.#fixtures().results.filter((result) => {
      if (lotteryExternalId && result.lotteryExternalId !== lotteryExternalId) return false;
      if (roundExternalId && result.roundExternalId !== roundExternalId) return false;
      if (status && result.status !== status) return false;
      return true;
    });
    return validateResults(results);
  }
}

module.exports = {
  MockLotteryProvider,
  __test: {
    baseFixtures
  }
};
