const axios = require('axios');
const { LotteryProviderError } = require('./providerError');
const {
  ALLOWED_QUERY_KEYS,
  ENDPOINTS,
  PROVIDER_CODE
} = require('./reviewedProviderContract');

const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_QUERY_VALUE_LENGTH = 160;
const SAFE_METHOD = 'GET';

const DEFAULT_CONTRACT = Object.freeze({
  providerCode: PROVIDER_CODE,
  endpoints: ENDPOINTS,
  allowedQueryKeys: ALLOWED_QUERY_KEYS
});

const providerError = (message, code, status = 502) => new LotteryProviderError(message, { code, status });

const isUrlLike = (value) => /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');

class ReviewedProviderClient {
  constructor({
    baseUrl = '',
    apiKey = '',
    timeoutMs = 5000,
    networkEnabled = false,
    transport = axios,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    contract = DEFAULT_CONTRACT
  } = {}) {
    this.baseUrl = String(baseUrl || '').trim();
    this.apiKey = String(apiKey || '').trim();
    this.timeoutMs = timeoutMs;
    this.networkEnabled = Boolean(networkEnabled);
    this.transport = transport;
    this.maxResponseBytes = maxResponseBytes;
    this.contract = {
      providerCode: contract.providerCode || PROVIDER_CODE,
      endpoints: contract.endpoints || {},
      allowedQueryKeys: contract.allowedQueryKeys || {}
    };
  }

  buildHeaders() {
    return {};
  }

  getProviderCode() {
    return this.contract.providerCode || PROVIDER_CODE;
  }

  getBaseUrl() {
    if (!this.baseUrl) {
      throw providerError(`${this.getProviderCode()} base URL is not configured`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    let base;
    try {
      base = new URL(this.baseUrl);
    } catch {
      throw providerError(`${this.getProviderCode()} base URL is invalid`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    if (base.username || base.password) {
      throw providerError(`${this.getProviderCode()} base URL must not contain credentials`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    return base;
  }

  buildUrl(endpointKey) {
    const endpointPath = this.contract.endpoints?.[endpointKey];
    if (typeof endpointPath !== 'string' || !endpointPath.trim()) {
      throw providerError(`${this.getProviderCode()} endpoint "${endpointKey}" is not confirmed`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    const path = endpointPath.trim();
    if (
      isUrlLike(path)
      || path.includes('\\')
      || path.includes('#')
    ) {
      throw providerError(`${this.getProviderCode()} endpoint "${endpointKey}" is not a safe same-origin path`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    const base = this.getBaseUrl();
    const target = new URL(path, base);
    if (target.origin !== base.origin || target.username || target.password || target.hash) {
      throw providerError(`${this.getProviderCode()} endpoint "${endpointKey}" is not a safe same-origin path`, 'LOTTERY_PROVIDER_NOT_CONFIGURED', 500);
    }

    return target.toString();
  }

  sanitizeQuery(endpointKey, query = {}) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) {
      throw providerError(`${this.getProviderCode()} query mapping is not confirmed`, 'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED', 500);
    }

    const allowed = new Set(this.contract.allowedQueryKeys?.[endpointKey] || []);
    const sanitized = {};
    for (const [key, value] of Object.entries(query)) {
      if (!allowed.has(key)) {
        throw providerError(`${this.getProviderCode()} query mapping is not confirmed`, 'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED', 500);
      }
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol') {
        throw providerError(`${this.getProviderCode()} query mapping is not confirmed`, 'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED', 500);
      }
      const text = String(value).trim();
      if (!text || text.length > MAX_QUERY_VALUE_LENGTH || isUrlLike(text) || text.startsWith('/') || text.includes('\\')) {
        throw providerError(`${this.getProviderCode()} query mapping is not confirmed`, 'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED', 500);
      }
      sanitized[key] = text;
    }
    return sanitized;
  }

  ensureResponseSize(data) {
    let size = 0;
    try {
      size = Buffer.byteLength(JSON.stringify(data ?? null), 'utf8');
    } catch {
      throw providerError(`${this.getProviderCode()} response is too large`, 'LOTTERY_PROVIDER_RESPONSE_TOO_LARGE', 502);
    }

    if (size > this.maxResponseBytes) {
      throw providerError(`${this.getProviderCode()} response is too large`, 'LOTTERY_PROVIDER_RESPONSE_TOO_LARGE', 502);
    }
  }

  handleStatus(status) {
    if (status >= 200 && status <= 299) return;

    if (status >= 300 && status <= 399) {
      throw providerError(`${this.getProviderCode()} redirect response was blocked`, 'LOTTERY_PROVIDER_REDIRECT_BLOCKED', 502);
    }

    if (status === 401 || status === 403) {
      throw providerError(`${this.getProviderCode()} request was unauthorized`, 'LOTTERY_PROVIDER_UNAUTHORIZED', 502);
    }

    if (status === 429) {
      throw providerError(`${this.getProviderCode()} request was rate limited`, 'LOTTERY_PROVIDER_RATE_LIMITED', 502);
    }

    if (status >= 500 && status <= 599) {
      throw providerError(`${this.getProviderCode()} provider is unavailable`, 'LOTTERY_PROVIDER_UNAVAILABLE', 502);
    }

    if (status >= 400 && status <= 499) {
      throw providerError(`${this.getProviderCode()} provider request failed`, 'LOTTERY_PROVIDER_ERROR', 502);
    }

    throw providerError(`${this.getProviderCode()} provider request failed`, 'LOTTERY_PROVIDER_ERROR', 502);
  }

  async get(endpointKey, { query = {} } = {}) {
    if (!this.networkEnabled) {
      throw providerError(`${this.getProviderCode()} network access is disabled`, 'LOTTERY_PROVIDER_NETWORK_DISABLED', 503);
    }

    const url = this.buildUrl(endpointKey);
    const params = this.sanitizeQuery(endpointKey, query);

    try {
      const response = await this.transport.request({
        method: SAFE_METHOD,
        url,
        params,
        headers: this.buildHeaders(),
        timeout: this.timeoutMs,
        maxRedirects: 0,
        responseType: 'json',
        maxContentLength: this.maxResponseBytes,
        maxBodyLength: this.maxResponseBytes,
        validateStatus: () => true
      });

      this.handleStatus(Number(response.status));
      this.ensureResponseSize(response.data);
      return response.data;
    } catch (error) {
      if (error instanceof LotteryProviderError) throw error;
      if (error.code === 'ECONNABORTED') {
        throw providerError(`${this.getProviderCode()} request timed out`, 'LOTTERY_PROVIDER_TIMEOUT', 504);
      }
      if (error.message && /maxContentLength|maxBodyLength|larger than max/i.test(error.message)) {
        throw providerError(`${this.getProviderCode()} response is too large`, 'LOTTERY_PROVIDER_RESPONSE_TOO_LARGE', 502);
      }
      throw providerError(`${this.getProviderCode()} request failed`, 'LOTTERY_PROVIDER_UNAVAILABLE', 502);
    }
  }

  safeSummary() {
    return {
      provider: this.getProviderCode(),
      baseUrlConfigured: Boolean(this.baseUrl),
      apiKeyConfigured: Boolean(this.apiKey),
      networkEnabled: this.networkEnabled,
      timeoutMs: this.timeoutMs
    };
  }
}

module.exports = {
  ReviewedProviderClient,
  __test: {
    DEFAULT_CONTRACT,
    DEFAULT_MAX_RESPONSE_BYTES,
    MAX_QUERY_VALUE_LENGTH,
    SAFE_METHOD
  }
};
