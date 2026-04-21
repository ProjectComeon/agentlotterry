import assert from 'node:assert/strict';

import {
  getFastKeyboardAction,
  hasAnyAmount
} from '../src/utils/operatorBettingKeyboard.js';

const order = ['top', 'bottom'];

assert.equal(hasAnyAmount({ top: '10', bottom: '' }, order), true);
assert.equal(hasAnyAmount({ top: '', bottom: '' }, order), false);

assert.deepEqual(
  getFastKeyboardAction({ field: 'order', order, amounts: { top: '', bottom: '' } }),
  { type: 'focus', field: 'top' },
  'Enter from order text should focus first enabled amount'
);

assert.deepEqual(
  getFastKeyboardAction({ field: 'top', order, amounts: { top: '10', bottom: '' } }),
  { type: 'focus', field: 'bottom' },
  'Enter from top should move to bottom while another amount field exists'
);

assert.deepEqual(
  getFastKeyboardAction({ field: 'bottom', order, amounts: { top: '10', bottom: '' } }),
  { type: 'saveDraftEntry' },
  'Enter on the last amount field should save the current entry when any amount was entered'
);

assert.deepEqual(
  getFastKeyboardAction({ field: 'bottom', order, amounts: { top: '', bottom: '15' } }),
  { type: 'saveDraftEntry' },
  'Enter on the last amount field should save bottom-only slips'
);

assert.deepEqual(
  getFastKeyboardAction({ field: 'bottom', order, amounts: { top: '', bottom: '' } }),
  { type: 'none' },
  'Enter on the last amount field should not submit without an amount'
);

assert.deepEqual(
  getFastKeyboardAction({ field: 'top', order: ['top'], amounts: { top: '10' } }),
  { type: 'saveDraftEntry' },
  'Single-column markets should save after the only amount field'
);

console.log('testOperatorBettingKeyboard passed');
