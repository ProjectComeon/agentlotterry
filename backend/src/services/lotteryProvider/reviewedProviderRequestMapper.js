const { LotteryProviderError } = require('./providerError');
const { PROVIDER_CODE } = require('./reviewedProviderContract');

const requestMappingUnconfirmed = (surface) => new LotteryProviderError(
  `${PROVIDER_CODE} ${surface} request mapping is not confirmed`,
  {
    code: 'LOTTERY_PROVIDER_REQUEST_MAPPING_UNCONFIRMED',
    status: 500
  }
);

const buildStatusRequest = () => ({ endpointKey: 'status', query: {} });
const buildLotteriesRequest = () => ({ endpointKey: 'lotteries', query: {} });

const buildRoundsRequest = () => {
  throw requestMappingUnconfirmed('rounds');
};

const buildRoundDetailRequest = () => {
  throw requestMappingUnconfirmed('round detail');
};

const buildResultsRequest = () => {
  throw requestMappingUnconfirmed('results');
};

module.exports = {
  buildStatusRequest,
  buildLotteriesRequest,
  buildRoundsRequest,
  buildRoundDetailRequest,
  buildResultsRequest,
  __test: {
    requestMappingUnconfirmed
  }
};
