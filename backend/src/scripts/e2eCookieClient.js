const axios = require('axios');
const { CSRF_COOKIE_NAME } = require('../utils/httpCookies');

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const normalizeSetCookieHeaders = (headers = {}) => {
  const value = headers['set-cookie'] || headers['Set-Cookie'] || [];
  return Array.isArray(value) ? value : [value].filter(Boolean);
};

const parseSetCookie = (headerValue = '') => {
  const [pair] = String(headerValue).split(';');
  const separatorIndex = pair.indexOf('=');
  if (separatorIndex === -1) return null;
  const name = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1);
  if (!name) return null;
  try {
    return { name, value: decodeURIComponent(value) };
  } catch {
    return { name, value };
  }
};

const createCookieJar = () => {
  const cookies = new Map();

  const storeFromResponse = (response = {}) => {
    for (const headerValue of normalizeSetCookieHeaders(response.headers || {})) {
      const parsed = parseSetCookie(headerValue);
      if (parsed) {
        cookies.set(parsed.name, parsed.value);
      }
    }
  };

  const get = (name) => cookies.get(name) || '';
  const cookieHeader = () => Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const applyToRequest = (config = {}) => {
    config.headers = config.headers || {};
    const headerValue = cookieHeader();
    if (headerValue) {
      config.headers.Cookie = headerValue;
    }

    const method = String(config.method || 'get').toLowerCase();
    const csrfToken = get(CSRF_COOKIE_NAME);
    if (UNSAFE_METHODS.has(method) && csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    delete config.headers.Authorization;
    return config;
  };

  return {
    applyToRequest,
    cookieHeader,
    get,
    storeFromResponse
  };
};

const createCookieSessionClient = ({ baseURL }) => {
  const cookieJar = createCookieJar();
  const client = axios.create({
    baseURL,
    validateStatus: () => true
  });

  client.interceptors.request.use((config) => cookieJar.applyToRequest(config));
  client.interceptors.response.use((response) => {
    cookieJar.storeFromResponse(response);
    return response;
  });
  client.cookieJar = cookieJar;

  return client;
};

module.exports = {
  createCookieJar,
  createCookieSessionClient,
  parseSetCookie
};