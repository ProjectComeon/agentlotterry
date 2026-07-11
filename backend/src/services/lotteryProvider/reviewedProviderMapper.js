const { LotteryProviderError } = require('./providerError');
const { PROVIDER_CODE, getMissingContractItems } = require('./reviewedProviderContract');

const unconfirmedMappingError = (surface) => new LotteryProviderError(
  `${PROVIDER_CODE} ${surface} mapping is not confirmed`,
  {
    code: 'LOTTERY_PROVIDER_MAPPING_INVALID',
    status: 502
  }
);

const requireConfirmedMapping = (surface) => {
  throw unconfirmedMappingError(surface);
};

const getMappingReview = () => ({
  provider: PROVIDER_CODE,
  status: 'unconfirmed',
  missing: getMissingContractItems(),
  confirmedMappings: [],
  unconfirmedMappings: [
    'provider lottery ID -> externalId',
    'provider lottery code -> code',
    'provider display name -> name/label',
    'provider timezone -> timezone',
    'provider round ID -> externalId',
    'provider lottery ID -> lotteryExternalId',
    'provider opening time -> openAt',
    'provider closing time -> closeAt',
    'provider draw/result time -> resultAt',
    'provider status -> canonical status',
    'provider result ID -> externalId',
    'provider round ID -> roundExternalId',
    'provider result numbers -> canonical number fields'
  ]
});

const mapProviderStatus = () => requireConfirmedMapping('status');
const mapLotteries = () => requireConfirmedMapping('lotteries');
const mapRounds = () => requireConfirmedMapping('rounds');
const mapRound = () => requireConfirmedMapping('round detail');
const mapResults = () => requireConfirmedMapping('results');

module.exports = {
  getMappingReview,
  mapProviderStatus,
  mapLotteries,
  mapRounds,
  mapRound,
  mapResults,
  __test: {
    requireConfirmedMapping,
    unconfirmedMappingError
  }
};