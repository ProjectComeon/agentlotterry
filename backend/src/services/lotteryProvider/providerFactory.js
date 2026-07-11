const {
  lotteryProvider,
  lotteryProviderMockScenario,
  lotteryApiBaseUrl,
  lotteryApiKey,
  lotteryApiTimeoutMs,
  lotteryRealNetworkEnabled
} = require('../../config/env');
const { LotteryProviderError } = require('./providerError');
const { MockLotteryProvider } = require('./mockLotteryProvider');
const { ReviewedProviderLotteryProvider } = require('./reviewedProviderLotteryProvider');

const SUPPORTED_PROVIDERS = new Set(['mock', 'reviewed-provider']);

const assertSupportedProvider = (providerName) => {
  const normalized = String(providerName ?? '').trim().toLowerCase();
  if (!normalized) {
    throw new LotteryProviderError('Lottery provider is not configured', {
      code: 'LOTTERY_PROVIDER_UNKNOWN',
      status: 500
    });
  }
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
  mockScenario = lotteryProviderMockScenario,
  baseUrl = lotteryApiBaseUrl,
  apiKey = lotteryApiKey,
  timeoutMs = lotteryApiTimeoutMs,
  networkEnabled = lotteryRealNetworkEnabled
} = {}) => {
  const providerName = assertSupportedProvider(provider);
  if (providerName === 'mock') {
    return new MockLotteryProvider({ scenario: mockScenario });
  }

  if (providerName === 'reviewed-provider') {
    return new ReviewedProviderLotteryProvider({
      baseUrl,
      apiKey,
      timeoutMs,
      networkEnabled
    });
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