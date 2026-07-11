const { LotteryProviderError } = require('./providerError');

const MAX_PROVIDER_ITEMS = 100;
const MAX_PROVIDER_PAYLOAD_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 160;
const LOTTERY_STATUSES = new Set(['active', 'inactive']);
const ROUND_STATUSES = new Set(['upcoming', 'open', 'closed', 'resulted']);
const RESULT_STATUSES = new Set(['pending', 'published']);
const PROVIDER_STATUSES = new Set(['ok', 'degraded', 'unavailable']);
const ISO_WITH_ZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;
const RESULT_NUMBER_DIGITS = {
  firstPrize: 6,
  threeTop: 3,
  twoTop: 2,
  twoBottom: 2,
  threeFront: 3,
  threeBottom: 3,
  threeTopHits: 3,
  twoTopHits: 2,
  twoBottomHits: 2,
  threeFrontHits: 3,
  threeBottomHits: 3,
  runTop: 1,
  runBottom: 1
};

const fail = (message, code = 'LOTTERY_PROVIDER_SCHEMA_INVALID') => {
  throw new LotteryProviderError(message, { code, status: 502 });
};

const ensurePayloadSize = (payload, label) => {
  const size = Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');
  if (size > MAX_PROVIDER_PAYLOAD_BYTES) {
    fail(`${label} payload exceeds ${MAX_PROVIDER_PAYLOAD_BYTES} bytes`, 'LOTTERY_PROVIDER_PAYLOAD_TOO_LARGE');
  }
};

const normalizeText = (value, field, { required = true, maxLength = MAX_TEXT_LENGTH } = {}) => {
  if (value === undefined || value === null) {
    if (required) fail(`${field} is required`);
    return '';
  }

  if (typeof value !== 'string') {
    fail(`${field} must be a text value`);
  }

  const text = value.trim();
  if (!text) {
    if (required) fail(`${field} is required`);
    return '';
  }

  if (text.length > maxLength) {
    fail(`${field} exceeds ${maxLength} characters`);
  }

  return text;
};

const normalizeExternalId = (value, field, { required = true, maxLength = MAX_TEXT_LENGTH } = {}) => {
  if (value === undefined || value === null) {
    if (required) fail(`${field} is required`);
    return '';
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    fail(`${field} must be a text or numeric value`);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail(`${field} must be a text or numeric value`);
  }

  const text = String(value).trim();
  if (!text) {
    if (required) fail(`${field} is required`);
    return '';
  }

  if (text.length > maxLength) {
    fail(`${field} exceeds ${maxLength} characters`);
  }

  return text;
};

const normalizeTimezone = (value, field = 'timezone') => {
  const timezone = normalizeText(value, field, { required: true, maxLength: 80 });
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
  } catch {
    fail(`${field} is not a supported timezone`);
  }
  return timezone;
};

const normalizeStatus = (value, allowed, field) => {
  const status = normalizeText(value, field).toLowerCase();
  if (!allowed.has(status)) {
    fail(`${field} is invalid`);
  }
  return status;
};

const normalizeDate = (value, field) => {
  const text = normalizeText(value, field, { maxLength: 80 });
  if (!ISO_WITH_ZONE_PATTERN.test(text)) {
    fail(`${field} must include an explicit timezone offset or Z`);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    fail(`${field} is not a valid date`);
  }

  return date.toISOString();
};

const normalizeOptionalDate = (value, field) => {
  if (value === undefined || value === null || value === '') return '';
  return normalizeDate(value, field);
};

const ensureArray = (value, label) => {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
  if (value.length > MAX_PROVIDER_ITEMS) {
    fail(`${label} exceeds ${MAX_PROVIDER_ITEMS} items`, 'LOTTERY_PROVIDER_PAYLOAD_TOO_LARGE');
  }
  return value;
};

const ensureUniqueExternalIds = (items, label) => {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.externalId)) {
      fail(`${label} contains duplicate externalId "${item.externalId}"`, 'LOTTERY_PROVIDER_DUPLICATE_ID');
    }
    ids.add(item.externalId);
  }
};

const normalizeTextList = (value, field, { maxLength = 40 } = {}) => {
  if (value === undefined || value === null) return [];
  const items = ensureArray(value, field);
  return items.map((item, index) => normalizeText(item, `${field}[${index}]`, { maxLength }));
};

const getResultDigits = (field) => {
  const key = field.split('.').pop().replace(/\[\d+\]$/, '');
  return RESULT_NUMBER_DIGITS[key];
};

const normalizeResultNumber = (value, field, digits) => {
  if (typeof value !== 'string') {
    fail(`${field} must be a digit string`);
  }
  const number = normalizeText(value, field, { maxLength: digits });
  if (!new RegExp(`^\\d{${digits}}$`).test(number)) {
    fail(`${field} must be exactly ${digits} digit${digits === 1 ? '' : 's'}`);
  }
  return number;
};

const normalizeOptionalResultNumber = (value, field) => {
  if (value === undefined || value === null || value === '') return '';
  const digits = getResultDigits(field);
  return normalizeResultNumber(value, field, digits);
};

const normalizeResultNumberList = (value, field) => {
  if (value === undefined || value === null) return [];
  const digits = getResultDigits(field);
  const items = ensureArray(value, field);
  return items.map((item, index) => normalizeResultNumber(item, `${field}[${index}]`, digits));
};

const normalizeResultNumbers = (value = {}) => {
  if (typeof value !== 'object' || Array.isArray(value) || value === null) {
    fail('result numbers must be an object');
  }

  return {
    headline: normalizeText(value.headline, 'numbers.headline', { required: false, maxLength: 160 }),
    firstPrize: normalizeOptionalResultNumber(value.firstPrize, 'numbers.firstPrize'),
    threeTop: normalizeOptionalResultNumber(value.threeTop, 'numbers.threeTop'),
    twoTop: normalizeOptionalResultNumber(value.twoTop, 'numbers.twoTop'),
    twoBottom: normalizeOptionalResultNumber(value.twoBottom, 'numbers.twoBottom'),
    threeFront: normalizeOptionalResultNumber(value.threeFront, 'numbers.threeFront'),
    threeBottom: normalizeOptionalResultNumber(value.threeBottom, 'numbers.threeBottom'),
    threeTopHits: normalizeResultNumberList(value.threeTopHits, 'numbers.threeTopHits'),
    twoTopHits: normalizeResultNumberList(value.twoTopHits, 'numbers.twoTopHits'),
    twoBottomHits: normalizeResultNumberList(value.twoBottomHits, 'numbers.twoBottomHits'),
    threeFrontHits: normalizeResultNumberList(value.threeFrontHits, 'numbers.threeFrontHits'),
    threeBottomHits: normalizeResultNumberList(value.threeBottomHits, 'numbers.threeBottomHits'),
    runTop: normalizeResultNumberList(value.runTop, 'numbers.runTop'),
    runBottom: normalizeResultNumberList(value.runBottom, 'numbers.runBottom')
  };
};

const validateProviderStatus = (payload) => {
  ensurePayloadSize(payload, 'provider status');
  return {
    provider: normalizeText(payload?.provider, 'provider'),
    status: normalizeStatus(payload?.status, PROVIDER_STATUSES, 'status'),
    checkedAt: normalizeDate(payload?.checkedAt, 'checkedAt'),
    message: normalizeText(payload?.message, 'message', { required: false, maxLength: 240 })
  };
};

const validateLotteries = (payload) => {
  ensurePayloadSize(payload, 'lotteries');
  const lotteries = ensureArray(payload, 'lotteries').map((item, index) => ({
    externalId: normalizeExternalId(item?.externalId, `lotteries[${index}].externalId`),
    code: normalizeText(item?.code, `lotteries[${index}].code`).toLowerCase(),
    name: normalizeText(item?.name, `lotteries[${index}].name`),
    label: normalizeText(item?.label, `lotteries[${index}].label`, { required: false }),
    type: normalizeText(item?.type, `lotteries[${index}].type`).toLowerCase(),
    status: normalizeStatus(item?.status || 'active', LOTTERY_STATUSES, `lotteries[${index}].status`),
    timezone: normalizeTimezone(item?.timezone, `lotteries[${index}].timezone`),
    provider: normalizeText(item?.provider, `lotteries[${index}].provider`, { required: false }),
    supportedBetTypes: normalizeTextList(item?.supportedBetTypes || [], `lotteries[${index}].supportedBetTypes`)
  }));
  ensureUniqueExternalIds(lotteries, 'lotteries');
  return lotteries;
};

const validateRounds = (payload) => {
  ensurePayloadSize(payload, 'rounds');
  const rounds = ensureArray(payload, 'rounds').map((item, index) => {
    const openAt = normalizeDate(item?.openAt, `rounds[${index}].openAt`);
    const closeAt = normalizeDate(item?.closeAt, `rounds[${index}].closeAt`);
    const resultAt = normalizeDate(item?.resultAt, `rounds[${index}].resultAt`);
    if (new Date(closeAt).getTime() <= new Date(openAt).getTime()) {
      fail(`rounds[${index}].closeAt must be after openAt`);
    }
    if (new Date(resultAt).getTime() < new Date(closeAt).getTime()) {
      fail(`rounds[${index}].resultAt must be at or after closeAt`);
    }

    return {
      externalId: normalizeExternalId(item?.externalId, `rounds[${index}].externalId`),
      lotteryExternalId: normalizeExternalId(item?.lotteryExternalId, `rounds[${index}].lotteryExternalId`),
      code: normalizeText(item?.code, `rounds[${index}].code`),
      displayName: normalizeText(item?.displayName === undefined || item?.displayName === null || item?.displayName === '' ? item?.name : item?.displayName, `rounds[${index}].displayName`),
      openAt,
      closeAt,
      resultAt,
      status: normalizeStatus(item?.status, ROUND_STATUSES, `rounds[${index}].status`),
      timezone: normalizeTimezone(item?.timezone, `rounds[${index}].timezone`)
    };
  });
  ensureUniqueExternalIds(rounds, 'rounds');
  return rounds;
};

const validateResults = (payload) => {
  ensurePayloadSize(payload, 'results');
  const results = ensureArray(payload, 'results').map((item, index) => ({
    externalId: normalizeExternalId(item?.externalId, `results[${index}].externalId`),
    lotteryExternalId: normalizeExternalId(item?.lotteryExternalId, `results[${index}].lotteryExternalId`),
    roundExternalId: normalizeExternalId(item?.roundExternalId, `results[${index}].roundExternalId`),
    status: normalizeStatus(item?.status, RESULT_STATUSES, `results[${index}].status`),
    resultAt: normalizeOptionalDate(item?.resultAt, `results[${index}].resultAt`),
    timezone: normalizeTimezone(item?.timezone, `results[${index}].timezone`),
    numbers: normalizeResultNumbers(item?.numbers || {})
  }));
  ensureUniqueExternalIds(results, 'results');
  return results;
};

module.exports = {
  MAX_PROVIDER_ITEMS,
  validateProviderStatus,
  validateLotteries,
  validateRounds,
  validateResults,
  __test: {
    normalizeDate,
    normalizeResultNumbers,
    normalizeTimezone
  }
};
