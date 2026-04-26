const assert = require('assert/strict');
const { __private } = require('../services/betSlipService');

const makeItem = ({ number, amount = 5, fromRood = false }) => ({
  betType: '2top',
  number,
  amount,
  payRate: 90,
  sourceFlags: {
    fromReverse: false,
    fromDoubleSet: false,
    fromRood
  }
});

const directDuplicate = __private.combineEntries([
  makeItem({ number: '12', amount: 5 }),
  makeItem({ number: '12', amount: 5 })
]);

assert.equal(directDuplicate.length, 1, 'direct 2-digit duplicates should stay deduped');
assert.equal(directDuplicate[0].amount, 5, 'direct duplicate stake should not be counted twice');

const roodDuplicate = __private.combineEntries([
  makeItem({ number: '12', amount: 5, fromRood: true }),
  makeItem({ number: '12', amount: 5, fromRood: true })
]);

assert.equal(roodDuplicate.length, 1, 'rood duplicate entries can still be stored as one combined item');
assert.equal(roodDuplicate[0].amount, 10, 'rood duplicate stake should be preserved for totals and payout');
assert.equal(roodDuplicate[0].potentialPayout, 900, 'rood duplicate payout should use the combined stake');
assert.equal(roodDuplicate[0].sourceFlags.fromRood, true, 'rood source flag should survive combination');

console.log('testBetSlipDuplicatePricing passed');
