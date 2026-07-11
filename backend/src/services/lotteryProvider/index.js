const { createLotteryProvider } = require('./providerFactory');
const { toSafeProviderError } = require('./providerError');

const getLotteryProvider = () => createLotteryProvider();

const getProviderStatus = () => getLotteryProvider().getProviderStatus();
const listLotteries = () => getLotteryProvider().listLotteries();
const listRounds = (params = {}) => getLotteryProvider().listRounds(params);
const getRound = (externalRoundId) => getLotteryProvider().getRound(externalRoundId);
const getResults = (params = {}) => getLotteryProvider().getResults(params);

module.exports = {
  getLotteryProvider,
  getProviderStatus,
  listLotteries,
  listRounds,
  getRound,
  getResults,
  toSafeProviderError
};
