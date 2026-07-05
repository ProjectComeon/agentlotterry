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
const appSource = fs.readFileSync(path.join(repoRoot, 'src/App.jsx'), 'utf8');
const navbarSource = fs.readFileSync(path.join(repoRoot, 'src/components/Navbar.jsx'), 'utf8');
const pendingPayoutPageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/shared/PendingPayoutsPage.jsx'), 'utf8');
assert.doesNotMatch(authContextSource, /localStorage\.(getItem|setItem|removeItem)\('token'\)/, 'auth flow must not persist bearer tokens in localStorage');
assert.doesNotMatch(apiSource, /Authorization\s*=|Bearer/, 'frontend API client should not send bearer tokens from localStorage');
assert.match(apiSource, /withCredentials:\s*true/, 'frontend API client should send cookie credentials');
assert.match(apiSource, /X-CSRF-Token/, 'frontend API client should attach CSRF header for unsafe methods');
assert.match(apiSource, /logoutSession = \(\) => api\.post\('\/auth\/logout'\)/, 'frontend logout should clear the server cookie session');
assert.match(apiSource, /getAdminPendingPayouts/, 'frontend API client should expose admin pending payout reads');
assert.match(apiSource, /getAgentPendingPayouts/, 'frontend API client should expose agent pending payout reads');
assert.match(apiSource, /markAdminNotificationRead/, 'frontend API client should expose admin notification read action');
assert.match(apiSource, /markAgentNotificationRead/, 'frontend API client should expose agent notification read action');
assert.match(appSource, /path="\/admin\/pending-payouts"[\s\S]*roles=\{\['admin'\]\}/, 'admin pending payout UI route should be admin-protected');
assert.match(appSource, /path="\/agent\/pending-payouts"[\s\S]*roles=\{\['agent'\]\}/, 'agent pending payout UI route should be agent-protected');
assert.match(navbarSource, /pendingBadgeCount/, 'navigation should render pending payout count without changing auth bootstrap');
assert.match(navbarSource, /getAdminPendingPayouts[\s\S]*getAgentPendingPayouts/, 'navigation pending payout badge should fetch counts by role');
assert.match(pendingPayoutPageSource, /markAdminNotificationRead[\s\S]*markAgentNotificationRead/, 'pending payout UI should only expose notification read actions');
assert.doesNotMatch(pendingPayoutPageSource, /\u0e08\u0e48\u0e32\u0e22\u0e41\u0e17\u0e19|manual\s+payout|pay\s+for\s+agent|adjustWalletCredit|transferWalletCredit|\/wallet\/adjust|\/wallet\/transfer/i, 'pending payout UI must not expose payout override or wallet mutation actions');
assert.doesNotMatch(navbarSource, /จ่ายแทน|pay\s+for\s+agent/i, 'navigation must not expose admin pay-for-agent actions');

console.log('testSecurityGuards: ok');
