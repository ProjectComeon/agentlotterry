const { ReviewedProviderClient } = require('./reviewedProviderClient');
const {
  getMappingReview,
  mapProviderStatus,
  mapLotteries,
  mapRounds,
  mapRound,
  mapResults
} = require('./reviewedProviderMapper');
const { PROVIDER_CODE } = require('./reviewedProviderContract');

class ReviewedProviderLotteryProvider {
  constructor(options = {}) {
    this.name = PROVIDER_CODE;
    this.client = options.client || new ReviewedProviderClient(options);
  }

  async getProviderStatus() {
    const payload = await this.client.get('status');
    return mapProviderStatus(payload);
  }

  async listLotteries() {
    const payload = await this.client.get('lotteries');
    return mapLotteries(payload);
  }

  async listRounds(params = {}) {
    const payload = await this.client.get('rounds', { query: params });
    return mapRounds(payload);
  }

  async getRound(externalRoundId) {
    const payload = await this.client.get('roundDetail', { query: { externalRoundId } });
    return mapRound(payload);
  }

  async getResults(params = {}) {
    const payload = await this.client.get('results', { query: params });
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