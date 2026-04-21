const assert = require('assert');

const { buildRoundUpsertOperations, getRoundStatus } = require('../services/catalogService');

const lotteryType = {
  _id: 'lottery-id',
  schedule: {
    type: 'daily',
    drawHour: 16,
    drawMinute: 0,
    closeHour: 15,
    closeMinute: 45,
    openLeadDays: 1
  }
};

const occurrences = [
  {
    code: '2026-04-19',
    title: 'รอบ 2026-04-19',
    openAt: new Date('2026-04-18T09:00:00.000Z'),
    closeAt: new Date('2026-04-19T08:45:00.000Z'),
    drawAt: new Date('2026-04-19T09:00:00.000Z')
  },
  {
    code: '2026-04-20',
    title: 'รอบ 2026-04-20',
    openAt: new Date('2026-04-19T09:00:00.000Z'),
    closeAt: new Date('2026-04-20T08:45:00.000Z'),
    drawAt: new Date('2026-04-20T09:00:00.000Z')
  }
];

const operations = buildRoundUpsertOperations(lotteryType, occurrences);

assert.strictEqual(operations.length, occurrences.length, 'should create one bulk op per occurrence');
assert.deepStrictEqual(
  operations.map((operation) => operation.updateOne.filter.code),
  ['2026-04-19', '2026-04-20'],
  'bulk ops should preserve occurrence order'
);
assert.strictEqual(
  operations[0].updateOne.filter.lotteryTypeId,
  'lottery-id',
  'bulk ops should target the lottery id'
);
assert.strictEqual(
  operations[0].updateOne.update.$setOnInsert.status,
  getRoundStatus(occurrences[0]).status,
  'bulk op should reuse round status calculation'
);
assert.strictEqual(
  operations[0].updateOne.update.$set.openAt,
  undefined,
  'catalog seed should not overwrite an existing round openAt'
);
assert.strictEqual(
  operations[0].updateOne.update.$set.closeAt,
  undefined,
  'catalog seed should not overwrite an existing round closeAt'
);
assert.strictEqual(
  operations[0].updateOne.update.$setOnInsert.openAt,
  occurrences[0].openAt,
  'catalog seed should still initialize new round openAt'
);
assert.strictEqual(
  operations[0].updateOne.update.$setOnInsert.closeAt,
  occurrences[0].closeAt,
  'catalog seed should still initialize new round closeAt'
);

console.log('Catalog seed bulk operation tests passed');
