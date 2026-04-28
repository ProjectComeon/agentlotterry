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

  if (!Number.isFinite(resultSyncIntervalMs) || resultSyncIntervalMs < 60000) {
    issues.push('RESULT_SYNC_INTERVAL_MS must be a number >= 60000');
  }

  if (!Number.isFinite(resultSyncStartupDelayMs) || resultSyncStartupDelayMs < 0) {
    issues.push('RESULT_SYNC_STARTUP_DELAY_MS must be a number >= 0');
  }

  if (cronSyncToken && cronSyncToken.length < 24) {
    issues.push('CRON_SYNC_TOKEN must be at least 24 characters long when set');
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

  if (issues.length) {
    const error = new Error(`Environment validation failed: ${issues.join('; ')}`);
    error.validationIssues = issues;
    throw error;
  }
};

const getEnvSummary = () => ({
  nodeEnv,
  isProduction,
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
  retentionKeepPreviousMonths
});

module.exports = {
  nodeEnv,
  isProduction,
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
  validateEnv,
  getEnvSummary
};
