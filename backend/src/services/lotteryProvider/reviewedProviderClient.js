const axios = require('axios');
const { LotteryProviderError } = require('./providerError');
const { ENDPOINTS, PROVIDER_CODE } = require('./reviewedProviderContract');

const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const SAFE_METHOD = 'GET';

const redactSecret = (value = '') => (value ? '[redacted]' : '');

class ReviewedProviderClient {
  constructor({
    baseUrl = '',
    apiKey = '',
    timeoutMs = 5000,
    networkEnabled = false,
    transport = axios,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
  } = {}) {
    this.baseUrl = String(baseUrl || '').trim();
    this.apiKey = String(apiKey || '').trim();
    this.timeoutMs = timeoutMs;
    this.networkEnabled = Boolean(networkEnabled);
    this.transport = transport;
    this.maxResponseBytes = maxResponseBytes;
  }

  buildHeaders() {
    return {};
  }

  buildUrl(endpointKey) {
    const path = ENDPOINTS[endpointKey];
    if (!path) {
      throw new LotteryProviderError(`${PROVIDER_CODE} endpoint "${endpointKey}" is not confirmed`, {
        code: 'LOTTERY_PROVIDER_NOT_CONFIGURED',
        status: 500
      });
    }
    return new URL(path, this.baseUrl).toString();
  }

  async get(endpointKey, { query = {} } = {}) {
    if (!this.networkEnabled) {
      throw new LotteryProviderError(`${PROVIDER_CODE} network access is disabled`, {
        code: 'LOTTERY_PROVIDER_NETWORK_DISABLED',
        status: 503
      });
    }

    if (!this.baseUrl) {
      throw new LotteryProviderError(`${PROVIDER_CODE} base URL is not configured`, {
        code: 'LOTTERY_PROVIDER_NOT_CONFIGURED',
        status: 500
      });
    }

    const url = this.buildUrl(endpointKey);
    try {
      const response = await this.transport.request({
        method: SAFE_METHOD,
        url,
        params: query,
        headers: this.buildHeaders(),
        timeout: this.timeoutMs,
        maxRedirects: 0,
        responseType: 'json',
        maxContentLength: this.maxResponseBytes,
        maxBodyLength: this.maxResponseBytes,
        validateStatus: () => true
      });

      if (response.status === 401 || response.status === 403) {
        throw new LotteryProviderError(`${PROVIDER_CODE} request was unauthorized`, {
          code: 'LOTTERY_PROVIDER_UNAUTHORIZED',
          status: 502
        });
      }

      if (response.status === 429) {
        throw new LotteryProviderError(`${PROVIDER_CODE} request was rate limited`, {
          code: 'LOTTERY_PROVIDER_RATE_LIMITED',
          status: 502
        });
      }

      if (response.status >= 500) {
        throw new LotteryProviderError(`${PROVIDER_CODE} provider is unavailable`, {
          code: 'LOTTERY_PROVIDER_UNAVAILABLE',
          status: 502
        });
      }

      if (response.status >= 400) {
        throw new LotteryProviderError(`${PROVIDER_CODE} provider request failed`, {
          code: 'LOTTERY_PROVIDER_ERROR',
          status: 502
        });
      }

      return response.data;
    } catch (error) {
      if (error instanceof LotteryProviderError) throw error;
      if (error.code === 'ECONNABORTED') {
        throw new LotteryProviderError(`${PROVIDER_CODE} request timed out`, {
          code: 'LOTTERY_PROVIDER_TIMEOUT',
          status: 504
        });
      }
      if (error.message && /maxContentLength|maxBodyLength|larger than max/i.test(error.message)) {
        throw new LotteryProviderError(`${PROVIDER_CODE} response is too large`, {
          code: 'LOTTERY_PROVIDER_RESPONSE_TOO_LARGE',
          status: 502
        });
      }
      throw new LotteryProviderError(`${PROVIDER_CODE} request failed`, {
        code: 'LOTTERY_PROVIDER_UNAVAILABLE',
        status: 502
      });
    }
  }

  safeSummary() {
    return {
      provider: PROVIDER_CODE,
      baseUrlConfigured: Boolean(this.baseUrl),
      apiKeyConfigured: Boolean(this.apiKey),
      apiKeyPreview: redactSecret(this.apiKey),
      networkEnabled: this.networkEnabled,
      timeoutMs: this.timeoutMs
    };
  }
}

module.exports = {
  ReviewedProviderClient,
  __test: {
    DEFAULT_MAX_RESPONSE_BYTES,
    SAFE_METHOD
  }
};
