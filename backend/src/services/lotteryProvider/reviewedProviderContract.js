const PROVIDER_CODE = 'reviewed-provider';

const CONTRACT_STATUS = 'unconfirmed';

const MISSING_CONTRACT_ITEMS = [
  'Provider name/code confirmation',
  'Official API documentation source',
  'Base URL',
  'Authentication mechanism and required headers',
  'List lotteries endpoint',
  'List rounds endpoint',
  'Round detail endpoint',
  'Results endpoint',
  'Provider health/status endpoint, if available',
  'Pagination policy',
  'Rate limits and Retry-After behavior',
  'Timezone policy and date/time formats',
  'Error response format',
  'Sample successful responses',
  'Sample error responses'
];

const ENDPOINTS = Object.freeze({});

const getMissingContractItems = () => [...MISSING_CONTRACT_ITEMS];

module.exports = {
  PROVIDER_CODE,
  CONTRACT_STATUS,
  ENDPOINTS,
  getMissingContractItems
};