const assert = require('assert');
const fs = require('fs');
const path = require('path');

const csrfProtection = require('../middleware/csrfProtection');
const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  clearAuthCookies,
  createCsrfToken,
  getAuthCookieToken,
  getCsrfCookieToken,
  parseCookieHeader,
  setAuthCookies
} = require('../utils/httpCookies');

const repoRoot = path.resolve(__dirname, '..', '..');

assert.strictEqual(parseCookieHeader('a=1; b=two').b, 'two');
assert.strictEqual(parseCookieHeader('encoded=a%20b').encoded, 'a b');

const reqWithCookie = { headers: { cookie: AUTH_COOKIE_NAME + '=jwt-token; ' + CSRF_COOKIE_NAME + '=csrf-token' } };
assert.strictEqual(getAuthCookieToken(reqWithCookie), 'jwt-token');
assert.strictEqual(getCsrfCookieToken(reqWithCookie), 'csrf-token');
assert.strictEqual(createCsrfToken().length > 24, true);

const cookiesSet = [];
const res = {
  cookie: (name, value, options) => cookiesSet.push({ name, value, options }),
  clearCookie: (name, options) => cookiesSet.push({ clear: true, name, options })
};
const csrfToken = setAuthCookies(res, 'jwt-token', 'csrf-token');
assert.strictEqual(csrfToken, 'csrf-token');
assert.strictEqual(cookiesSet.find((item) => item.name === AUTH_COOKIE_NAME).options.httpOnly, true);
assert.strictEqual(cookiesSet.find((item) => item.name === CSRF_COOKIE_NAME).options.httpOnly, false);
clearAuthCookies(res);
assert.strictEqual(cookiesSet.filter((item) => item.clear).length, 2);

const makeReq = ({ method = 'POST', path = '/api/admin/agents', cookie = 'csrf-token', header = 'csrf-token' } = {}) => ({
  method,
  path,
  headers: { cookie: cookie ? CSRF_COOKIE_NAME + '=' + cookie : '' },
  get: (name) => (name.toLowerCase() === CSRF_HEADER_NAME ? header : '')
});
const makeRes = () => {
  const out = { statusCode: 200, body: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (body) => { out.body = body; return out; };
  return out;
};
let continued = false;
csrfProtection(makeReq(), makeRes(), () => { continued = true; });
assert.strictEqual(continued, true, 'matching CSRF token should continue');
const blockedRes = makeRes();
csrfProtection(makeReq({ header: 'bad-token' }), blockedRes, () => {});
assert.strictEqual(blockedRes.statusCode, 403, 'invalid CSRF should be blocked');
continued = false;
csrfProtection(makeReq({ method: 'GET', header: '' }), makeRes(), () => { continued = true; });
assert.strictEqual(continued, true, 'safe methods should not require CSRF');
continued = false;
csrfProtection(makeReq({ path: '/api/auth/login', header: '' }), makeRes(), () => { continued = true; });
assert.strictEqual(continued, true, 'login should bootstrap CSRF cookie without a prior token');
continued = false;
csrfProtection({
  ...makeReq({ header: '' }),
  headers: { authorization: 'Bearer jwt-token' }
}, makeRes(), () => { continued = true; });
assert.strictEqual(continued, true, 'explicit bearer API clients should not require CSRF');

const authSource = fs.readFileSync(path.join(repoRoot, 'src/middleware/auth.js'), 'utf8');
assert.match(authSource, /getAuthCookieToken/, 'auth middleware should read httpOnly cookie token');
const authRoutesSource = fs.readFileSync(path.join(repoRoot, 'src/routes/authRoutes.js'), 'utf8');
assert.match(authRoutesSource, /setAuthCookies/, 'login should set auth cookies');
assert.match(authRoutesSource, /router\.post\('\/logout'/, 'logout route should clear auth cookies');
assert.match(authRoutesSource, /X-Allow-Bearer-Response/, 'bearer token response should require an explicit compatibility header');
assert.doesNotMatch(authRoutesSource, /res\.json\(\{\s*token,/s, 'browser login response should not expose bearer token by default');

console.log('testCookieAuthGuards: ok');