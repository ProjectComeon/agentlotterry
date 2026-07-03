const {
  CSRF_HEADER_NAME,
  getCsrfCookieToken,
  getCsrfHeaderToken
} = require('../utils/httpCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/health',
  '/ready',
  '/lottery/sync-latest/cron'
]);

const normalizePath = (value = '') => String(value || '')
  .split('?')[0]
  .replace(/^\/api(?=\/|$)/, '') || '/';
const isExemptPath = (req) => EXEMPT_PATHS.has(normalizePath(req.path))
  || EXEMPT_PATHS.has(normalizePath(req.originalUrl));
const isCsrfRequired = (req) => !SAFE_METHODS.has(req.method) && !isExemptPath(req);
const hasBearerAuthorization = (req) => /^Bearer\s+\S+/i.test(String(
  req.get?.('Authorization') || req.headers?.authorization || ''
));

const csrfProtection = (req, res, next) => {
  if (!isCsrfRequired(req) || hasBearerAuthorization(req)) {
    return next();
  }

  const cookieToken = getCsrfCookieToken(req);
  const headerToken = getCsrfHeaderToken(req);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      message: 'Invalid CSRF token.',
      requiredHeader: CSRF_HEADER_NAME
    });
  }

  return next();
};

module.exports = csrfProtection;
module.exports.__test = {
  EXEMPT_PATHS,
  SAFE_METHODS,
  hasBearerAuthorization,
  isCsrfRequired,
  isExemptPath,
  normalizePath
};