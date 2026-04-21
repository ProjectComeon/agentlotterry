import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd(), 'frontend');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const preloadSource = read('src/utils/appPreload.js');
const appSource = read('src/App.jsx');
const navbarSource = read('src/components/Navbar.jsx');
const bottomNavSource = read('src/components/BottomNav.jsx');

[
  'routeLoaders',
  'preloadRoleRouteChunks',
  'preloadAppRouteForPath',
  'warmAppRouteDataForPath',
  'requestIdleCallback',
  'WARM_DATA_DEDUP_MS'
].forEach((token) => {
  assert.match(preloadSource, new RegExp(token), `appPreload should include ${token}`);
});

[
  'getAdminDashboard',
  'getAdminCustomers',
  'getAdminBets',
  'getAdminReports',
  'getAgentDashboard',
  'getAgentMemberBootstrap',
  'getAgentMembers',
  'getAgentBets',
  'getAgentReports',
  'getCatalogOverview',
  'getMarketOverview'
].forEach((token) => {
  assert.match(preloadSource, new RegExp(token), `appPreload should warm ${token}`);
});

assert.match(appSource, /lazy\(routeLoaders\.adminDashboard\)/, 'App should lazy-load from shared route loaders');
assert.match(appSource, /preloadRoleRouteChunks\(user\.role\)/, 'App layout should preload chunks for the current role');
assert.doesNotMatch(appSource, /warmRoleData\(user\.role\)/, 'App layout should not warm every role route on first load');
assert.doesNotMatch(preloadSource, /export const warmRoleData/, 'role-wide data warming should not exist as a first-load path');

assert.match(navbarSource, /preloadAppRouteForPath\(path, user\?\.role\)/, 'Navbar should preload route chunks before navigation');
assert.match(navbarSource, /warmAppRouteDataForPath\(path, user\?\.role\)/, 'Navbar should warm route data before navigation');
assert.match(bottomNavSource, /preloadAppRouteForPath\(path, user\?\.role\)/, 'BottomNav should preload route chunks before navigation');
assert.match(bottomNavSource, /warmAppRouteDataForPath\(path, user\?\.role\)/, 'BottomNav should warm route data before navigation');

console.log('app preload checks passed');
