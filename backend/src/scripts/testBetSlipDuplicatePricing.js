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

assert.equal(directDuplicate.length, 2, 'direct 2-digit duplicates should stay as separate priced items');
assert.equal(directDuplicate.reduce((sum, item) => sum + item.amount, 0), 10, 'direct duplicate stake should be preserved for totals and payout');
assert.equal(directDuplicate.reduce((sum, item) => sum + item.potentialPayout, 0), 900, 'direct duplicate payout should count every duplicate stake');

const roodDuplicate = __private.combineEntries([
  makeItem({ number: '12', amount: 5, fromRood: true }),
  makeItem({ number: '12', amount: 5, fromRood: true })
]);

assert.equal(roodDuplicate.length, 2, 'rood duplicate entries should stay as separate priced items');
assert.equal(roodDuplicate.reduce((sum, item) => sum + item.amount, 0), 10, 'rood duplicate stake should be preserved for totals and payout');
assert.equal(roodDuplicate.reduce((sum, item) => sum + item.potentialPayout, 0), 900, 'rood duplicate payout should count every duplicate stake');
assert.equal(roodDuplicate.every((item) => item.sourceFlags.fromRood), true, 'rood source flag should survive on every duplicate');

const laoSetDuplicate = __private.combineEntries([
  { ...makeItem({ number: '1234', amount: 120 }), betType: 'lao_set4', payRate: 1 },
  { ...makeItem({ number: '1234', amount: 120 }), betType: 'lao_set4', payRate: 1 }
]);

assert.equal(laoSetDuplicate.length, 2, 'Lao set duplicate numbers should stay as separate priced items');
assert.equal(laoSetDuplicate.reduce((sum, item) => sum + item.amount, 0), 240, 'Lao set duplicate stakes should preserve one 120-baht stake per set');
assert.equal(laoSetDuplicate.reduce((sum, item) => sum + item.potentialPayout, 0), 300000, 'Lao set potential payout should use 150,000 per set');

assert.throws(
  () => __private.combineEntries([
    { ...makeItem({ number: '1234', amount: 100 }), betType: 'lao_set4', payRate: 1 }
  ]),
  /Lao set amount must be 120 per set/,
  'Lao set amount must be validated as 120-baht sets'
);

console.log('testBetSlipDuplicatePricing passed');
