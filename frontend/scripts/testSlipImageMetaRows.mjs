import assert from 'node:assert/strict';
import {
  buildPreviewImagePayload,
  buildSavedSlipImagePayload,
  buildSlipImageMetaRows
} from '../src/utils/slipImage.js';

const getMemberRowValue = (payload) => buildSlipImageMetaRows(payload)[0]?.value;

const previewPayload = buildPreviewImagePayload({
  preview: {
    member: { name: 'Tester Preview' },
    items: []
  },
  selectedMember: { name: 'Fallback Preview' },
  selectedLottery: { name: 'หวยลาว' },
  selectedRound: { code: '2026-04-19' }
});

assert.equal(getMemberRowValue(previewPayload), 'Tester Preview');

const savedPayload = buildSavedSlipImagePayload({
  slip: {
    customer: { name: 'Tester Saved' },
    marketName: 'หวยลาว',
    roundDate: '2026-04-19',
    items: []
  }
});

assert.equal(getMemberRowValue(savedPayload), 'Tester Saved');

const fallbackSavedPayload = buildSavedSlipImagePayload({
  slip: {
    customerName: 'Tester Fallback',
    marketName: 'หวยลาว',
    roundDate: '2026-04-19',
    items: []
  }
});

assert.equal(getMemberRowValue(fallbackSavedPayload), 'Tester Fallback');
assert.deepEqual(
  buildSlipImageMetaRows(savedPayload).map((row) => row.label),
  ['สมาชิก', 'ตลาด', 'งวด']
);

console.log('testSlipImageMetaRows: ok');
