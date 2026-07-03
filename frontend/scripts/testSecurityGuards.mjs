import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialAuthState } from '../src/utils/authBootstrap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const initialState = buildInitialAuthState({
  token: 'token',
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

console.log('testSecurityGuards: ok');
