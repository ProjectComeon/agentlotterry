const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const catalogService = read('services/catalogService.js');
const dashboardService = read('services/dashboardSnapshotService.js');
const schedulerService = read('services/readModelSnapshotService.js');

assert(catalogService.includes('CATALOG_OVERVIEW_STALE_MAX_MS'), 'catalog service must define a max stale window');
assert(catalogService.includes('loadCatalogOverviewSnapshotState'), 'catalog service must load snapshot freshness metadata');
assert(catalogService.includes("viewer?.role !== 'customer'"), 'catalog read path must keep customer betting snapshots fresh-only');
assert(catalogService.includes('allowStale: allowStaleSnapshot'), 'catalog read path must allow stale persistent snapshots for non-customer readers');
assert(catalogService.includes('catalog-stale-memory-read'), 'catalog read path must serve stale memory snapshots and refresh in background');
assert(catalogService.includes('catalog-stale-persistent-read'), 'catalog read path must serve stale persistent snapshots and refresh in background');
assert(catalogService.includes("targets: ['catalog']"), 'catalog stale reads should schedule catalog-only rebuilds');

assert(dashboardService.includes('DASHBOARD_SNAPSHOT_STALE_MAX_MS'), 'dashboard service must define a max stale window');
assert(dashboardService.includes('loadDashboardSnapshotState'), 'dashboard service must load snapshot freshness metadata');
assert(dashboardService.includes('allowStale: true'), 'dashboard read path must allow stale persistent snapshots');
assert(dashboardService.includes('dashboard-stale-memory-read'), 'dashboard read path must serve stale memory snapshots and refresh in background');
assert(dashboardService.includes('dashboard-stale-persistent-read'), 'dashboard read path must serve stale persistent snapshots and refresh in background');
assert(dashboardService.includes("targets: ['dashboard']"), 'dashboard stale reads should schedule dashboard-only rebuilds');

assert(schedulerService.includes('SNAPSHOT_TARGETS'), 'scheduler must understand targeted snapshot rebuilds');
assert(schedulerService.includes('normalizeTargets'), 'scheduler must normalize targeted rebuild requests');
assert(schedulerService.includes("targets.includes('market')"), 'scheduler must gate market rebuilds by target');
assert(schedulerService.includes("targets.includes('catalog')"), 'scheduler must gate catalog rebuilds by target');
assert(schedulerService.includes("targets.includes('dashboard')"), 'scheduler must gate dashboard rebuilds by target');

console.log('Phase 4 stale snapshot assertions passed');
