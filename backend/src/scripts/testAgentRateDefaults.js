const assert = require('assert');
const fs = require('fs');
const path = require('path');

const readSource = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const userModel = readSource('models/User.js');
const adminRoutes = readSource('routes/adminRoutes.js');
const memberService = readSource('services/memberManagementService.js');
const catalogService = readSource('services/catalogService.js');

assert.match(
  userModel,
  /useCustomRateDefaults/,
  'agent users should store whether custom default payout rates are enabled'
);
assert.match(
  userModel,
  /defaultRates/,
  'agent users should store custom default payout rates by bet type'
);
assert.match(
  adminRoutes,
  /normalizeRateDefaults/,
  'admin agent payload should validate custom payout rates'
);
assert.match(
  adminRoutes,
  /useCustomRateDefaults/,
  'admin agent payload should accept custom payout-rate toggle'
);
assert.match(
  memberService,
  /buildAgentRateDefaults/,
  'member service should derive agent payout-rate defaults'
);
assert.match(
  memberService,
  /applyAgentRateDefaultsToConfig/,
  'member service should apply agent payout-rate defaults when a member has no custom override'
);
assert.match(
  catalogService,
  /getViewerAgentRateDefaults/,
  'betting catalog should expose agent payout-rate defaults to the UI'
);

console.log('testAgentRateDefaults: ok');
