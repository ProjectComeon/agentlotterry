const { lotteryProvider, lotteryProviderMockScenario } = require('../../config/env');
const { LotteryProviderError } = require('./providerError');
const { MockLotteryProvider } = require('./mockLotteryProvider');

const SUPPORTED_PROVIDERS = new Set(['mock']);

const assertSupportedProvider = (providerName) => {
  const normalized = String(providerName || 'mock').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new LotteryProviderError(`Unknown lottery provider "${normalized}"`, {
      code: 'LOTTERY_PROVIDER_UNKNOWN',
      status: 500
    });
  }
  return normalized;
};

const createLotteryProvider = ({
  provider = lotteryProvider,
  mockScenario = lotteryProviderMockScenario
} = {}) => {
  const providerName = assertSupportedProvider(provider);
  if (providerName === 'mock') {
    return new MockLotteryProvider({ scenario: mockScenario });
  }

  throw new LotteryProviderError(`Unsupported lottery provider "${providerName}"`, {
    code: 'LOTTERY_PROVIDER_UNKNOWN',
    status: 500
  });
};

module.exports = {
  SUPPORTED_PROVIDERS,
  assertSupportedProvider,
  createLotteryProvider
};
