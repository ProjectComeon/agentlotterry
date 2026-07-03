const crypto = require('crypto');
const { isProduction } = require('../config/env');

const AUTH_COOKIE_NAME = 'agentlottery_auth';
const CSRF_COOKIE_NAME = 'agentlottery_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const COOKIE_PATH = '/';

const parseCookieHeader = (headerValue = '') => String(headerValue || '')
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .reduce((acc, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) return acc;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1);
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }
    return acc;
  }, {});

const getRequestCookies = (req) => parseCookieHeader(req?.headers?.cookie || '');

const getCookieOptions = ({ httpOnly = false, maxAge = AUTH_COOKIE_MAX_AGE_MS } = {}) => ({
  httpOnly,
  secure: isProduction,
  sameSite: 'lax',
  path: COOKIE_PATH,
  maxAge
});

const createCsrfToken = () => crypto.randomBytes(32).toString('base64url');

const setAuthCookies = (res, token, csrfToken = createCsrfToken()) => {
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions({ httpOnly: true }));
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions({ httpOnly: false }));
  return csrfToken;
};

const clearAuthCookies = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE_NAME, { path: COOKIE_PATH });
};

const getAuthCookieToken = (req) => getRequestCookies(req)[AUTH_COOKIE_NAME] || "";
const getCsrfCookieToken = (req) => getRequestCookies(req)[CSRF_COOKIE_NAME] || "";
const getCsrfHeaderToken = (req) => String(req.get?.(CSRF_HEADER_NAME) || req.get?.('X-CSRF-Token') || '').trim();

module.exports = {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  COOKIE_PATH,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  clearAuthCookies,
  createCsrfToken,
  getAuthCookieToken,
  getCookieOptions,
  getCsrfCookieToken,
  getCsrfHeaderToken,
  getRequestCookies,
  parseCookieHeader,
  setAuthCookies
};
