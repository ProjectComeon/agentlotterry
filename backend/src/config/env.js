const path = require('path');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const INSECURE_JWT_SECRETS = new Set([
  'changeme',
  'secret',
  'jwt_secret',
  'agentlottery_jwt_secret_key_2024_x9k2m'
]);

const toText = (value, fallback = '') => String(value ?? fallback).trim();

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = toText(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
};

const normalizeLogFormat = (value, fallback) => {
  const normalized = toText(value, fallback).toLowerCase();
  if (normalized === 'json') {
    return 'combined';
  }
  return normalized;
};

const nodeEnv = toText(process.env.NODE_ENV, 'development').toLowerCase();
const isProduction = nodeEnv === 'production';
const rawBackendHost = String(process.env.BACKEND_HOST ?? '');
const backendHost = toText(process.env.BACKEND_HOST);
const frontendUrl = toText(process.env.FRONTEND_URL);
const autoSeedAdmin = parseBoolean(process.env.AUTO_SEED_ADMIN, !isProduction);
const defaultAdminUsername = toText(process.env.DEFAULT_ADMIN_USERNAME, !isProduction ? 'admin' : '');
const defaultAdminPassword = toText(process.env.DEFAULT_ADMIN_PASSWORD, !isProduction ? 'admin123' : '');
const jwtSecret = toText(process.env.JWT_SECRET);
const logFormat = normalizeLogFormat(process.env.LOG_FORMAT, isProduction ? 'combined' : 'dev');
const trustProxy = parseBoolean(process.env.TRUST_PROXY, isProduction);
const exposeHealthDetails = parseBoolean(process.env.HEALTH_EXPOSE_DETAILS, !isProduction);
const backupDir = path.resolve(process.cwd(), toText(process.env.BACKUP_DIR, './backups'));
const manyCaiFeedBaseUrl = toText(process.env.MANYCAI_FEED_BASE_URL, 'http://vip.manycai.com/K269c291856f58e');
const autoSyncResults = parseBoolean(process.env.AUTO_SYNC_RESULTS, false);
const autoSeedCatalog = parseBoolean(process.env.AUTO_SEED_CATALOG, !isProduction);
const resultSyncIntervalMs = Number(process.env.RESULT_SYNC_INTERVAL_MS || 300000);
const resultSyncStartupDelayMs = Number(process.env.RESULT_SYNC_STARTUP_DELAY_MS || 60000);
const cronSyncToken = toText(process.env.CRON_SYNC_TOKEN);
const autoRetentionCleanup = parseBoolean(process.env.AUTO_RETENTION_CLEANUP, false);
const retentionCleanupIntervalMs = Number(process.env.RETENTION_CLEANUP_INTERVAL_MS || 86400000);
const retentionCleanupStartupDelayMs = Number(process.env.RETENTION_CLEANUP_STARTUP_DELAY_MS || 120000);
const retentionKeepPreviousMonths = Number(process.env.RETENTION_KEEP_PREVIOUS_MONTHS || 1);
const rawLotteryProvider = process.env.LOTTERY_PROVIDER;
const lotteryProviderConfigured = Boolean(toText(rawLotteryProvider));
const lotteryProvider = lotteryProviderConfigured ? toText(rawLotteryProvider).toLowerCase() : (isProduction ? '' : 'mock');
const lotteryApiBaseUrl = toText(process.env.LOTTERY_API_BASE_URL);
const lotteryApiKey = toText(process.env.LOTTERY_API_KEY);
const lotteryApiTimeoutMs = Number(process.env.LOTTERY_API_TIMEOUT_MS || 5000);
const lotteryProviderMockScenario = toText(process.env.LOTTERY_PROVIDER_MOCK_SCENARIO, 'valid').toLowerCase();

const isLocalOrPrivateHost = (hostname) => {
  const normalized = toText(hostname).toLowerCase();
  return normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.startsWith('127.') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    normalized.startsWith('169.254.');
};

const validateEnv = () => {
  const issues = [];

  if (!toText(process.env.MONGODB_URI)) {
    issues.push('MONGODB_URI is required');
  }

  if (!jwtSecret) {
    issues.push('JWT_SECRET is required');
  }

  if (jwtSecret && jwtSecret.length < 24) {
    issues.push('JWT_SECRET must be at least 24 characters long');
  }

  if (isProduction && INSECURE_JWT_SECRETS.has(jwtSecret)) {
    issues.push('JWT_SECRET uses an insecure known value');
  }

  if (isProduction && !frontendUrl) {
    issues.push('FRONTEND_URL is required in production');
  }

  if (autoSeedAdmin && (!defaultAdminUsername || !defaultAdminPassword)) {
    issues.push('DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD are required when AUTO_SEED_ADMIN=true');
  }

  if (isProduction && autoSeedAdmin && defaultAdminPassword === 'admin123') {
    issues.push('DEFAULT_ADMIN_PASSWORD cannot use the development default in production');
  }

  if (!['dev', 'combined', 'common', 'short', 'tiny'].includes(logFormat)) {
    issues.push(`LOG_FORMAT "${logFormat}" is not supported by morgan`);
  }

  if (backendHost && (/\s|[/\\]/.test(rawBackendHost) || backendHost.includes('://'))) {
    issues.push('BACKEND_HOST must be a bind host only, for example 127.0.0.1, 0.0.0.0, ::1, or a private hostname');
  }

  if (!Number.isFinite(resultSyncIntervalMs) || resultSyncIntervalMs < 60000) {
    issues.push('RESULT_SYNC_INTERVAL_MS must be a number >= 60000');
  }

  if (!Number.isFinite(resultSyncStartupDelayMs) || resultSyncStartupDelayMs < 0) {
    issues.push('RESULT_SYNC_STARTUP_DELAY_MS must be a number >= 0');
  }

  if (cronSyncToken && cronSyncToken.length < 24) {
    issues.push('CRON_SYNC_TOKEN must be at least 24 characters long when set');
  }

  if (isProduction && !autoSyncResults && !cronSyncToken) {
    issues.push('CRON_SYNC_TOKEN is required in production when AUTO_SYNC_RESULTS=false');
  }

  if (!Number.isFinite(retentionCleanupIntervalMs) || retentionCleanupIntervalMs < 60000) {
    issues.push('RETENTION_CLEANUP_INTERVAL_MS must be a number >= 60000');
  }

  if (!Number.isFinite(retentionCleanupStartupDelayMs) || retentionCleanupStartupDelayMs < 0) {
    issues.push('RETENTION_CLEANUP_STARTUP_DELAY_MS must be a number >= 0');
  }

  if (!Number.isFinite(retentionKeepPreviousMonths) || retentionKeepPreviousMonths < 1) {
    issues.push('RETENTION_KEEP_PREVIOUS_MONTHS must be a number >= 1');
  }

  if (isProduction && !lotteryProviderConfigured) {
    issues.push('LOTTERY_PROVIDER is required in production; set LOTTERY_PROVIDER=mock explicitly only for preview/validation');
  }

  if (lotteryProvider && !['mock'].includes(lotteryProvider)) {
    issues.push(`LOTTERY_PROVIDER "${lotteryProvider}" is not supported`);
  }

  if (!Number.isFinite(lotteryApiTimeoutMs) || lotteryApiTimeoutMs < 1000 || lotteryApiTimeoutMs > 30000) {
    issues.push('LOTTERY_API_TIMEOUT_MS must be a number between 1000 and 30000');
  }

  if (lotteryApiBaseUrl) {
    try {
      const url = new URL(lotteryApiBaseUrl);
      if (url.username || url.password) {
        issues.push('LOTTERY_API_BASE_URL must not include credentials');
      }
      if (isProduction && url.protocol !== 'https:') {
        issues.push('LOTTERY_API_BASE_URL must use HTTPS in production');
      }
      if (isProduction && isLocalOrPrivateHost(url.hostname)) {
        issues.push('LOTTERY_API_BASE_URL must not point to local or private hosts in production');
      }
    } catch {
      issues.push('LOTTERY_API_BASE_URL must be a valid absolute URL when set');
    }
  }

  if (issues.length) {
    const error = new Error(`Environment validation failed: ${issues.join('; ')}`);
    error.validationIssues = issues;
    throw error;
  }
};

const getEnvSummary = () => ({
  nodeEnv,
  isProduction,
  backendHostConfigured: Boolean(backendHost),
  frontendUrlConfigured: Boolean(frontendUrl),
  autoSeedAdmin,
  defaultAdminUsernameConfigured: Boolean(defaultAdminUsername),
  trustProxy,
  exposeHealthDetails,
  logFormat,
  backupDir,
  manyCaiFeedBaseUrlConfigured: Boolean(manyCaiFeedBaseUrl),
  autoSyncResults,
  autoSeedCatalog,
  resultSyncIntervalMs,
  resultSyncStartupDelayMs,
  cronSyncTokenConfigured: Boolean(cronSyncToken),
  autoRetentionCleanup,
  retentionCleanupIntervalMs,
  retentionCleanupStartupDelayMs,
  retentionKeepPreviousMonths,
  lotteryProvider,
  lotteryProviderConfigured,
  lotteryApiBaseUrlConfigured: Boolean(lotteryApiBaseUrl),
  lotteryApiKeyConfigured: Boolean(lotteryApiKey),
  lotteryApiTimeoutMs,
  lotteryProviderMockScenario
});

module.exports = {
  nodeEnv,
  isProduction,
  backendHost,
  frontendUrl,
  autoSeedAdmin,
  defaultAdminUsername,
  defaultAdminPassword,
  jwtSecret,
  trustProxy,
  exposeHealthDetails,
  logFormat,
  backupDir,
  manyCaiFeedBaseUrl,
  autoSyncResults,
  autoSeedCatalog,
  resultSyncIntervalMs,
  resultSyncStartupDelayMs,
  cronSyncToken,
  autoRetentionCleanup,
  retentionCleanupIntervalMs,
  retentionCleanupStartupDelayMs,
  retentionKeepPreviousMonths,
  lotteryProvider,
  lotteryProviderConfigured,
  lotteryApiBaseUrl,
  lotteryApiKey,
  lotteryApiTimeoutMs,
  lotteryProviderMockScenario,
  validateEnv,
  getEnvSummary
};
