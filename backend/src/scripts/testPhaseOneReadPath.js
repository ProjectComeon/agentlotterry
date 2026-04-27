const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const catalogSource = read('services/catalogService.js');
const memberManagementSource = read('services/memberManagementService.js');
const betItemModelSource = read('models/BetItem.js');
const betSlipModelSource = read('models/BetSlip.js');
const resultRecordModelSource = read('models/ResultRecord.js');
const userModelSource = read('models/User.js');

assert.match(
  catalogSource,
  /const getLotteryOptions = async \(viewer = null\) => \{[\s\S]*const overview = await getCatalogOverview\(viewer\);[\s\S]*\(overview\.leagues \|\| \[\]\)\.flatMap/,
  'catalog lottery options should read from the catalog overview snapshot path'
);
assert.match(catalogSource, /\.populate\('drawRoundId', 'code title drawAt resultPublishedAt'\)\s*\.lean\(\)/, 'recent results should use lean reads');
assert.match(catalogSource, /LotteryLeague\.find\(\{ isActive: true \}\)[\s\S]*\.lean\(\)/, 'catalog leagues should use lean reads');
assert.match(catalogSource, /loadActiveLotteries\(\)/, 'catalog overview should use the shared active lottery helper');
assert.match(memberManagementSource, /LotteryType\.find\(\{ isActive: true \}\)[\s\S]*\.populate\('defaultRateProfileId'[\s\S]*\.lean\(\)/, 'catalog lotteries should use lean reads');
assert.match(catalogSource, /DrawRound\.find\(\{ isActive: true[\s\S]*\.lean\(\)/, 'catalog rounds should use lean reads');

[
  /betItemSchema\.index\(\{ status: 1, agentId: 1, customerId: 1, createdAt: -1 \}\)/,
  /betItemSchema\.index\(\{ status: 1, customerId: 1, createdAt: -1 \}\)/,
  /betItemSchema\.index\(\{ status: 1, agentId: 1, result: 1, createdAt: -1 \}\)/,
  /betItemSchema\.index\(\{ status: 1, createdAt: -1 \}\)/
].forEach((pattern) => assert.match(betItemModelSource, pattern, `BetItem missing index ${pattern}`));

[
  /betSlipSchema\.index\(\{ status: 1, createdAt: -1, _id: -1 \}\)/,
  /betSlipSchema\.index\(\{ status: 1, agentId: 1, createdAt: -1, _id: -1 \}\)/,
  /betSlipSchema\.index\(\{ status: 1, agentId: 1, customerId: 1, createdAt: -1, _id: -1 \}\)/,
  /betSlipSchema\.index\(\{ status: 1, lotteryCode: 1, roundCode: 1, createdAt: -1, _id: -1 \}\)/
].forEach((pattern) => assert.match(betSlipModelSource, pattern, `BetSlip missing index ${pattern}`));

assert.match(resultRecordModelSource, /resultRecordSchema\.index\(\{ isPublished: 1, updatedAt: -1 \}\)/, 'ResultRecord should index published latest reads');
assert.match(resultRecordModelSource, /resultRecordSchema\.index\(\{ isPublished: 1, lotteryTypeId: 1, updatedAt: -1 \}\)/, 'ResultRecord should index per-lottery latest reads');

assert.match(userModelSource, /userSchema\.index\(\{ role: 1, isActive: 1 \}\)/, 'User should index role status counts');
assert.match(userModelSource, /userSchema\.index\(\{ agentId: 1, role: 1, isActive: 1, status: 1, lastActiveAt: -1 \}\)/, 'User should index agent member lists and online filters');

console.log('testPhaseOneReadPath: ok');
