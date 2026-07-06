import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialAuthState } from '../src/utils/authBootstrap.js';
import { normalizeUnauthorizedRequestPath, shouldRedirectToLoginForUnauthorized } from '../src/utils/authRedirectPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const initialState = buildInitialAuthState({
  storedUser: JSON.stringify({ id: 'u1', role: 'admin' }),
  normalizeUser: (user) => user
});
assert.equal(initialState.loading, true, 'stored auth state must stay loading until /auth/me revalidates');
assert.equal(initialState.shouldRevalidate, true);
assert.equal(initialState.user.id, 'u1');
assert.equal(normalizeUnauthorizedRequestPath('/api/auth/me?probe=1'), '/auth/me');
assert.equal(shouldRedirectToLoginForUnauthorized({
  requestUrl: '/auth/me',
  currentPathname: '/login'
}), false, 'auth bootstrap 401 must not reload the login page');
assert.equal(shouldRedirectToLoginForUnauthorized({
  requestUrl: '/auth/login',
  currentPathname: '/login'
}), false, 'failed login should show an error without full-page redirect');
assert.equal(shouldRedirectToLoginForUnauthorized({
  requestUrl: '/admin/dashboard',
  currentPathname: '/admin'
}), true, 'protected API 401 should still send stale sessions back to login');
assert.equal(shouldRedirectToLoginForUnauthorized({
  requestUrl: '/admin/dashboard',
  currentPathname: '/login'
}), false, 'login page must not redirect to itself on background 401');

const panelSource = fs.readFileSync(path.join(repoRoot, 'src/pages/admin/LotteryDetailPanel.jsx'), 'utf8');
assert.match(panelSource, /new URL\(String\(value \|\| ''\)\.trim\(\)\)/, 'source URLs should be parsed before rendering');
assert.match(panelSource, /href=\{getSafeExternalUrl\(selectedResult\?\.sourceUrl\)\}/, 'external result link should use sanitized URL');
assert.doesNotMatch(panelSource, /href=\{selectedResult\.sourceUrl\}/, 'raw result source URL must not be used in href');

const authContextSource = fs.readFileSync(path.join(repoRoot, 'src/context/AuthContext.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(repoRoot, 'src/services/api.js'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'src/App.jsx'), 'utf8');
const navbarSource = fs.readFileSync(path.join(repoRoot, 'src/components/Navbar.jsx'), 'utf8');
const pendingPayoutPageSource = fs.readFileSync(path.join(repoRoot, 'src/pages/shared/PendingPayoutsPage.jsx'), 'utf8');
const memberDashboardSourcePath = path.join(repoRoot, 'src/pages/member/MemberDashboard.jsx');
const memberDashboardSource = fs.existsSync(memberDashboardSourcePath) ? fs.readFileSync(memberDashboardSourcePath, 'utf8') : '';
const memberBuySourcePath = path.join(repoRoot, 'src/pages/member/MemberBuy.jsx');
const memberBuySource = fs.existsSync(memberBuySourcePath) ? fs.readFileSync(memberBuySourcePath, 'utf8') : '';
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
assert.match(appSource, /path="\/member"[\s\S]*roles=\{\['customer'\]\}/, 'member dashboard route should be customer-protected');
assert.match(appSource, /path="\/member\/buy"[\s\S]*roles=\{\['customer'\]\}/, 'member buy route should be customer-protected');
assert.match(appSource, /path="\/member\/slips"[\s\S]*roles=\{\['customer'\]\}/, 'member slips route should be customer-protected');
assert.match(appSource, /path="\/member\/slips\/:id"[\s\S]*roles=\{\['customer'\]\}/, 'member slip detail route should be customer-protected');
assert.match(appSource, /path="\/member\/wallet"[\s\S]*roles=\{\['customer'\]\}/, 'member wallet route should be customer-protected');
assert.match(appSource, /path="\/member\/pending-payouts"[\s\S]*roles=\{\['customer'\]\}/, 'member pending payout route should be customer-protected');
assert.match(appSource, /path="\/member\/notifications"[\s\S]*roles=\{\['customer'\]\}/, 'member notification route should be customer-protected');
assert.match(navbarSource, /pendingBadgeCount/, 'navigation should render pending payout count without changing auth bootstrap');
assert.match(navbarSource, /getAdminPendingPayouts[\s\S]*getAgentPendingPayouts/, 'navigation pending payout badge should fetch counts by role');
assert.match(navbarSource, /getMemberPendingPayouts/, 'navigation should fetch member-scoped pending payout badge count');
assert.match(navbarSource, /const handleLogout = async \(\) => \{[\s\S]*await logout\(\);[\s\S]*navigate\('\/login'\);/, 'navigation logout should wait for server cookie cleanup before redirecting');
assert.match(pendingPayoutPageSource, /markAdminNotificationRead[\s\S]*markAgentNotificationRead/, 'pending payout UI should only expose notification read actions');
assert.doesNotMatch(pendingPayoutPageSource, /\u0e08\u0e48\u0e32\u0e22\u0e41\u0e17\u0e19|manual\s+payout|pay\s+for\s+agent|adjustWalletCredit|transferWalletCredit|\/wallet\/adjust|\/wallet\/transfer/i, 'pending payout UI must not expose payout override or wallet mutation actions');
assert.doesNotMatch(navbarSource, /\u0e08\u0e48\u0e32\u0e22\u0e41\u0e17\u0e19|pay\s+for\s+agent/i, 'navigation must not expose admin pay-for-agent actions');
assert.match(memberDashboardSource, /getMemberRounds/, 'member dashboard should load member-scoped open rounds');
assert.match(memberDashboardSource, /member-round-card/, 'member dashboard should render selectable round cards');
assert.match(memberDashboardSource, /\/member\/buy\?[\s\S]*roundId/, 'member dashboard round cards should link into buy flow with selected roundId');
assert.match(memberBuySource, /submitMemberSlip/, 'member buy UI should submit through the member self-buying API');
assert.match(memberBuySource, /createMemberDraftSlip/, 'member buy UI should preview through member draft API instead of legacy parse');
assert.doesNotMatch(memberBuySource, /parseMemberSlip|customerId|agentId|actorUser|placedBy/, 'member buy UI must not call legacy parse or send customer/agent/actor overrides');
assert.match(memberBuySource, /useSearchParams/, 'member buy UI should preselect a round from dashboard query params');
assert.match(memberBuySource, /requestedRoundId/, 'member buy UI should track the requested roundId from the dashboard');
assert.match(memberBuySource, /member-self-only-notice/, 'member buy UI should clearly avoid customer/member selection');
assert.match(memberBuySource, /clientRequestId/, 'member buy UI should send a clientRequestId for idempotent submit');
assert.match(memberBuySource, /submitLockRef/, 'member buy UI should guard duplicate submit clicks');
assert.doesNotMatch(memberBuySource, /\/member\/slips\/parse|api\.post\('\/member\/slips'\)/, 'member buy UI must not call legacy member slip endpoints');

console.log('testSecurityGuards: ok');
