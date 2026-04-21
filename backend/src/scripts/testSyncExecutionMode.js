const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { resolveSyncExecutionMode } = require('../services/externalResultFeedService');

assert.deepStrictEqual(
  resolveSyncExecutionMode(),
  {
    runSettlement: true,
    mode: 'full'
  },
  'default sync mode should keep inline settlement'
);

assert.deepStrictEqual(
  resolveSyncExecutionMode({ runSettlement: false }),
  {
    runSettlement: false,
    mode: 'fetch-store'
  },
  'manual fetch/store mode should skip inline settlement'
);

const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/externalResultFeedService.js'),
  'utf8'
);
const envSource = fs.readFileSync(
  path.resolve(__dirname, '../config/env.js'),
  'utf8'
);
const serverSource = fs.readFileSync(
  path.resolve(__dirname, '../../server.js'),
  'utf8'
);

assert.match(
  serviceSource,
  /RESULT_SYNC_STARTUP_DELAY_MS[\s\S]*60000/,
  'auto-sync should default to a delayed first run'
);
assert.match(
  serviceSource,
  /setTimeout[\s\S]*runSync\(\)[\s\S]*startInterval\(\)/,
  'auto-sync should delay the first heavy sync before starting the interval'
);
assert.match(
  serviceSource,
  /clearTimeout\(autoSyncStartupTimer\)/,
  'restarting auto-sync should clear pending startup timers'
);
assert.match(
  envSource,
  /resultSyncStartupDelayMs/,
  'env config should expose RESULT_SYNC_STARTUP_DELAY_MS'
);
assert.match(
  serverSource,
  /startupDelayMs: resultSyncStartupDelayMs/,
  'server should pass startup delay into auto-sync scheduler'
);

console.log('Sync execution mode tests passed');
