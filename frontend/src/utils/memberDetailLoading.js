const MEMBER_WALLET_TAB = 'กระเป๋า';

const shouldLoadMemberWalletSection = ({
  activeTab = '',
  walletLoaded = false,
  walletLoading = false
} = {}) => activeTab === MEMBER_WALLET_TAB && !walletLoaded && !walletLoading;

export {
  MEMBER_WALLET_TAB,
  shouldLoadMemberWalletSection
};
