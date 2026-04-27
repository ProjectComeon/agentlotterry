const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const scheduler = read('services/readModelSnapshotService.js');
const server = fs.readFileSync(path.resolve(__dirname, '..', '..', 'server.js'), 'utf8');
const externalFeedService = read('services/externalResultFeedService.js');
const lotteryRoutes = read('routes/lotteryRoutes.js');
const adminRoutes = read('routes/adminRoutes.js');
const agentRoutes = read('routes/agentRoutes.js');
const bettingRoutes = read('routes/helpers/registerBettingRoutes.js');
const dashboardService = read('services/dashboardSnapshotService.js');

assert(scheduler.includes('scheduleReadModelSnapshotRebuild'), 'scheduler must expose queued rebuild API');
assert(scheduler.includes('startReadModelSnapshotAutoRefresh'), 'scheduler must expose startup/interval auto refresh');
assert(scheduler.includes('rebuildMarketOverviewSnapshot'), 'scheduler must rebuild market overview snapshots');
assert(scheduler.includes('rebuildOperatorCatalogOverviewSnapshots'), 'scheduler must rebuild catalog overview snapshots');
assert(scheduler.includes('rebuildDashboardSnapshots'), 'scheduler must rebuild dashboard snapshots');
assert(scheduler.includes('pendingOptions'), 'scheduler must debounce and merge pending rebuild work');

assert(server.includes('startReadModelSnapshotAutoRefresh'), 'server must start read model snapshot auto refresh after startup');
assert(externalFeedService.includes('readModelSnapshotSchedule'), 'external sync summary must expose scheduled snapshot rebuild');
assert(
  /includeAgents:\s*Boolean\(summary\.settlements\s*\|\|\s*summary\.safetySettlements\)/.test(externalFeedService),
  'external sync must target agent dashboards when settlement changes stats'
);

assert(lotteryRoutes.includes('scheduleSettlementRefresh'), 'lottery routes must schedule settlement read-model refresh');
assert(lotteryRoutes.includes('scheduleCatalogRefresh'), 'lottery routes must schedule catalog read-model refresh');
assert(lotteryRoutes.includes('readModelSnapshots'), 'sync-status must include read model state');

assert(adminRoutes.includes('scheduleReadModelSnapshotRebuild'), 'admin writes must schedule read-model refresh');
assert(agentRoutes.includes('scheduleReadModelSnapshotRebuild'), 'agent writes must schedule read-model refresh');
assert(bettingRoutes.includes('scheduleReadModelSnapshotRebuild'), 'betting writes must schedule read-model refresh');
assert(!adminRoutes.includes('clearDashboardSnapshots()'), 'admin writes should not force synchronous persistent snapshot deletes');
assert(!agentRoutes.includes('clearDashboardSnapshots()'), 'agent writes should not force synchronous persistent snapshot deletes');
assert(!bettingRoutes.includes('clearDashboardSnapshots()'), 'betting writes should not force synchronous persistent snapshot deletes');

assert(dashboardService.includes('agentIds = []'), 'dashboard rebuild must support targeted agent snapshot refresh');

console.log('Phase 3 snapshot scheduler assertions passed');
