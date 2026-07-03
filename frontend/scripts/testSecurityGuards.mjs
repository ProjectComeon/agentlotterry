import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialAuthState } from '../src/utils/authBootstrap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const initialState = buildInitialAuthState({
  storedUser: JSON.stringify({ id: 'u1', role: 'admin' }),
  normalizeUser: (user) => user
});
assert.equal(initialState.loading, true, 'stored auth state must stay loading until /auth/me revalidates');
assert.equal(initialState.shouldRevalidate, true);
assert.equal(initialState.user.id, 'u1');

const panelSource = fs.readFileSync(path.join(repoRoot, 'src/pages/admin/LotteryDetailPanel.jsx'), 'utf8');
assert.match(panelSource, /new URL\(String\(value \|\| ''\)\.trim\(\)\)/, 'source URLs should be parsed before rendering');
assert.match(panelSource, /href=\{getSafeExternalUrl\(selectedResult\?\.sourceUrl\)\}/, 'external result link should use sanitized URL');
assert.doesNotMatch(panelSource, /href=\{selectedResult\.sourceUrl\}/, 'raw result source URL must not be used in href');

const authContextSource = fs.readFileSync(path.join(repoRoot, 'src/context/AuthContext.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(repoRoot, 'src/services/api.js'), 'utf8');
assert.doesNotMatch(authContextSource, /localStorage\.(getItem|setItem|removeItem)\('token'\)/, 'auth flow must not persist bearer tokens in localStorage');
assert.doesNotMatch(apiSource, /Authorization\s*=|Bearer/, 'frontend API client should not send bearer tokens from localStorage');
assert.match(apiSource, /withCredentials:\s*true/, 'frontend API client should send cookie credentials');
assert.match(apiSource, /X-CSRF-Token/, 'frontend API client should attach CSRF header for unsafe methods');
assert.match(apiSource, /logoutSession = \(\) => api\.post\('\/auth\/logout'\)/, 'frontend logout should clear the server cookie session');

console.log('testSecurityGuards: ok');
