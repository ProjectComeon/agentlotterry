const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const catalogServiceSource = read('services/catalogService.js');
const bettingRoutesSource = read('routes/helpers/registerBettingRoutes.js');

assert.match(
  catalogServiceSource,
  /const getBettingCatalogOverview = async \(viewer = null\) => getCachedCatalogOverview\(viewer, \{/,
  'catalog service should expose a lightweight betting catalog overview'
);
assert.match(
  catalogServiceSource,
  /cacheVariant: 'betting'[\s\S]*includeAnnouncements: false[\s\S]*includeRecentResults: false/,
  'betting catalog overview should skip announcements and recent results'
);
assert.match(
  catalogServiceSource,
  /getMemberConfigRows\(\{ member: viewer, lotteries, ensureMissing: false \}\)/,
  'member betting catalog read path should not upsert all missing lottery configs'
);
assert.match(
  catalogServiceSource,
  /CATALOG_OVERVIEW_CACHE_MS \|\| 60000/,
  'catalog overview cache should default to a longer read TTL'
);
assert.match(
  bettingRoutesSource,
  /const \{ getBettingCatalogOverview \} = require\('\.\.\/\.\.\/services\/catalogService'\);/,
  'betting routes should import the lightweight betting catalog overview'
);
assert.match(
  bettingRoutesSource,
  /getBettingCatalogOverview\(member\)/,
  'member betting context should load the lightweight catalog'
);
assert.match(
  bettingRoutesSource,
  /const shouldIncludeTotals = req\.query\.includeTotals === '1' \|\| req\.query\.includeTotals === 'true';/,
  'member betting context should make expensive totals opt-in'
);
assert.match(
  bettingRoutesSource,
  /shouldIncludeTotals[\s\S]*\? getBetTotals\(buildMemberTotalsParams\(req, member\)\)[\s\S]*: Promise\.resolve\(\{\}\)/,
  'member betting context should skip totals aggregates by default'
);
assert.doesNotMatch(
  bettingRoutesSource,
  /getCatalogOverview\(member\)/,
  'member betting context should not load the full catalog overview'
);

console.log('testBettingCatalogContext: ok');
