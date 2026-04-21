import assert from 'node:assert/strict';
import {
  MEMBER_WALLET_TAB,
  shouldLoadMemberWalletSection
} from '../src/utils/memberDetailLoading.js';

assert.equal(MEMBER_WALLET_TAB, 'กระเป๋า', 'wallet tab label should stay in sync with the UI');

assert.equal(
  shouldLoadMemberWalletSection({ activeTab: 'ข้อมูลทั่วไป', walletLoaded: false, walletLoading: false }),
  false,
  'wallet data should not load while the user stays on general tabs'
);

assert.equal(
  shouldLoadMemberWalletSection({ activeTab: MEMBER_WALLET_TAB, walletLoaded: false, walletLoading: false }),
  true,
  'wallet data should load the first time the wallet tab opens'
);

assert.equal(
  shouldLoadMemberWalletSection({ activeTab: MEMBER_WALLET_TAB, walletLoaded: true, walletLoading: false }),
  false,
  'wallet data should not refetch on every tab revisit once cached locally'
);

assert.equal(
  shouldLoadMemberWalletSection({ activeTab: MEMBER_WALLET_TAB, walletLoaded: false, walletLoading: true }),
  false,
  'wallet data should not issue duplicate requests while an existing load is in flight'
);

console.log('testMemberDetailLoading passed');
