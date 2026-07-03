const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

const attemptsByKey = new Map();

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const windowMs = toPositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS);
const maxAttempts = toPositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);

const getLoginRateLimitKey = (req) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${username || 'anonymous'}`;
};

const getAttemptBucket = (key, now = Date.now()) => {
  const existing = attemptsByKey.get(key);
  if (existing && existing.resetAt > now) {
    return existing;
  }

  const bucket = { count: 0, resetAt: now + windowMs };
  attemptsByKey.set(key, bucket);
  return bucket;
};

const loginRateLimit = (req, res, next) => {
  const key = getLoginRateLimitKey(req);
  const bucket = getAttemptBucket(key);

  if (bucket.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  bucket.count += 1;
  req.loginRateLimitKey = key;
  return next();
};

const resetLoginRateLimit = (req) => {
  if (req?.loginRateLimitKey) {
    attemptsByKey.delete(req.loginRateLimitKey);
  }
};

module.exports = {
  loginRateLimit,
  resetLoginRateLimit,
  __test: {
    attemptsByKey,
    getLoginRateLimitKey,
    getAttemptBucket,
    maxAttempts,
    windowMs
  }
};
