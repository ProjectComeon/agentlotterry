const { ReviewedProviderClient } = require('./reviewedProviderClient');
const {
  getMappingReview,
  mapProviderStatus,
  mapLotteries,
  mapRounds,
  mapRound,
  mapResults
} = require('./reviewedProviderMapper');
const {
  buildStatusRequest,
  buildLotteriesRequest,
  buildRoundsRequest,
  buildRoundDetailRequest,
  buildResultsRequest
} = require('./reviewedProviderRequestMapper');
const { PROVIDER_CODE } = require('./reviewedProviderContract');

class ReviewedProviderLotteryProvider {
  constructor(options = {}) {
    this.name = PROVIDER_CODE;
    this.client = options.client || new ReviewedProviderClient(options);
  }

  async getProviderStatus() {
    const request = buildStatusRequest();
    const payload = await this.client.get(request.endpointKey, { query: request.query });
    return mapProviderStatus(payload);
  }

  async listLotteries() {
    const request = buildLotteriesRequest();
    const payload = await this.client.get(request.endpointKey, { query: request.query });
    return mapLotteries(payload);
  }

  async listRounds(params = {}) {
    const request = buildRoundsRequest(params);
    const payload = await this.client.get(request.endpointKey, { query: request.query });
    return mapRounds(payload);
  }

  async getRound(externalRoundId) {
    const request = buildRoundDetailRequest(externalRoundId);
    const payload = await this.client.get(request.endpointKey, { query: request.query });
    return mapRound(payload);
  }

  async getResults(params = {}) {
    const request = buildResultsRequest(params);
    const payload = await this.client.get(request.endpointKey, { query: request.query });
    return mapResults(payload);
  }

  getMappingReview() {
    return getMappingReview();
  }
}

module.exports = {
  ReviewedProviderLotteryProvider,
  __test: {
    getMappingReview
  }
};
