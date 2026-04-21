const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../services/memberManagementService.js'),
  'utf8'
);

assert.match(
  source,
  /ensureOnlyMissing = false/,
  'member config upsert should keep full-update behavior as the default'
);
assert.match(
  source,
  /const hasExplicitLotterySettings = inputSettings\.length > 0;/,
  'member config upsert should preserve explicit lottery settings updates'
);
assert.match(
  source,
  /const targetLotteries = ensureOnlyMissing && !hasExplicitLotterySettings/,
  'member config upsert should support an insert-missing-only read path'
);
assert.match(
  source,
  /activeLotteries\.filter\(\(lottery\) => !existingMap\[lottery\._id\.toString\(\)\]\)/,
  'insert-missing-only mode should skip existing member lottery configs'
);
assert.match(
  source,
  /getMemberConfigRows[\s\S]*ensureOnlyMissing: true/,
  'getMemberConfigRows should avoid full config rewrites on read'
);

console.log('testMemberConfigReadPath: ok');
