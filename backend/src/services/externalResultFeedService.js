const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const MarketFeedResult = require('../models/MarketFeedResult');
const { createBangkokDate } = require('../utils/bangkokTime');
const { ensureRoundForLottery, settleRoundById, upsertRoundResult } = require('./resultService');
const { fetchGsbSnapshots } = require('./gsbResultService');
const { fetchLaosPathanaSnapshots } = require('./laosPathanaResultService');

const legacyBaseUrl = (process.env.MANYCAI_BASE_URL || 'http://vip.manycai.com').replace(/\/$/, '');
const legacyApiKey = String(process.env.MANYCAI_API_KEY || '').trim();
const MANYCAI_FEED_BASE_URL = (
  process.env.MANYCAI_FEED_BASE_URL ||
  (legacyApiKey ? `${legacyBaseUrl}/${legacyApiKey}` : 'http://vip.manycai.com/K269c291856f58e')
).replace(/\/$/, '');
const RESULT_SYNC_TIMEOUT_MS = Number(process.env.RESULT_SYNC_TIMEOUT_MS || 12000);
const STRICT_FEED_MAPPING = String(process.env.STRICT_FEED_MAPPING || '1') !== '0';
const GSB_SYNC_LIMIT = Number(process.env.GSB_SYNC_LIMIT || 6);
const LAOS_PATHANA_SYNC_LIMIT = Number(process.env.LAOS_PATHANA_SYNC_LIMIT || 10);

const defaultMappedDigits = (value) => String(value || '').replace(/\D/g, '');
const defaultMappedList = (value) => {
  const flatten = (input) => Array.isArray(input) ? input.flatMap(flatten) : [input];
  return [...new Set(flatten(value).map(defaultMappedDigits).filter(Boolean))];
};

const scalarField = (path, transform = defaultMappedDigits) => ({ path, transform });
const listField = (path, transform = defaultMappedList) => ({ path, transform, isList: true });

const governmentFeedMapping = () => ({
  kind: 'government',
  firstPrize: scalarField('code.code'),
  threeFrontHits: listField('code.code1'),
  threeBottomHits: listField('code.code2'),
  twoBottom: scalarField('code.code3')
});

const stockFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code'),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code1')
});

const hanoiFiveDigitFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code', (value) => tailDigits(value, 3)),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code1', (value) => tailDigits(value, 2))
});

const fourDigitPre2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code_last2'),
  twoBottom: scalarField('code.code_pre2')
});

const fiveDigitCode2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code_last2'),
  twoBottom: scalarField('code.code2')
});

const yikiMid2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code_mid2')
});

const baacFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code', (value) => tailDigits(value, 3)),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code', (value) => middleDigits(value, 2))
});

const EXPLICIT_FEED_MAPPINGS = {
  hnvip: hanoiFiveDigitFeedMapping(),
  tlzc: fourDigitPre2FeedMapping(),
  tykc: yikiMid2FeedMapping(),
  tgfc: governmentFeedMapping(),
  baac: baacFeedMapping(),
  gshka: stockFeedMapping(),
  gshkp: stockFeedMapping(),
  bfhn: hanoiFiveDigitFeedMapping(),
  gstw: stockFeedMapping(),
  gsjpa: stockFeedMapping(),
  gsjpp: stockFeedMapping(),
  gskr: stockFeedMapping(),
  gscna: stockFeedMapping(),
  gscnp: stockFeedMapping(),
  gssg: stockFeedMapping(),
  gsth: stockFeedMapping(),
  gsin: stockFeedMapping(),
  gseg: stockFeedMapping(),
  gsru: stockFeedMapping(),
  gsde: stockFeedMapping(),
  gsuk: stockFeedMapping(),
  gsus: stockFeedMapping(),
  cqhn: hanoiFiveDigitFeedMapping(),
  zcvip: fiveDigitCode2FeedMapping(),
  ynhn: fourDigitPre2FeedMapping(),
  ynma: fourDigitPre2FeedMapping()
};

const FEED_CONFIGS = [
  { feedCode: 'hnvip', lotteryCode: 'hnvip', marketName: 'ฮานอย VIP', parser: 'simple', syncToResults: true },
  { feedCode: 'tlzc', lotteryCode: 'tlzc', marketName: 'หวยลาว', parser: 'simple', syncToResults: true },
  { feedCode: 'tykc', lotteryCode: 'tykc', marketName: 'ยี่กี VIP', parser: 'simple', syncToResults: true },
  { feedCode: 'tgfc', lotteryCode: 'thai_government', marketName: 'รัฐบาลไทย', parser: 'government', syncToResults: true },
  { feedCode: 'baac', lotteryCode: 'baac', marketName: 'ธ.ก.ส.', parser: 'baac', syncToResults: true },
  { feedCode: 'gshka', lotteryCode: 'gshka', marketName: 'หุ้นฮั่งเส็ง เช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gshkp', lotteryCode: 'gshkp', marketName: 'หุ้นฮั่งเส็ง บ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'bfhn', lotteryCode: 'hanoi_special', marketName: 'ฮานอยพิเศษ', parser: 'simple', syncToResults: true },
  { feedCode: 'gstw', lotteryCode: 'gstw', marketName: 'หุ้นไต้หวัน', parser: 'stock', syncToResults: true },
  { feedCode: 'gsjpa', lotteryCode: 'nikkei_morning', marketName: 'นิเคอิเช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gsjpp', lotteryCode: 'gsjpp', marketName: 'นิเคอิบ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'gskr', lotteryCode: 'gskr', marketName: 'หุ้นเกาหลี', parser: 'stock', syncToResults: true },
  { feedCode: 'gscna', lotteryCode: 'gscna', marketName: 'หุ้นจีนเช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gscnp', lotteryCode: 'china_afternoon', marketName: 'หุ้นจีนบ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'gssg', lotteryCode: 'gssg', marketName: 'หุ้นสิงคโปร์', parser: 'stock', syncToResults: true },
  { feedCode: 'gsth', lotteryCode: 'gsth', marketName: 'หุ้นไทย', parser: 'stock', syncToResults: true },
  { feedCode: 'gsin', lotteryCode: 'gsin', marketName: 'หุ้นอินเดีย', parser: 'stock', syncToResults: true },
  { feedCode: 'gseg', lotteryCode: 'gseg', marketName: 'หุ้นอียิปต์', parser: 'stock', syncToResults: true },
  { feedCode: 'gsru', lotteryCode: 'gsru', marketName: 'หุ้นรัสเซีย', parser: 'stock', syncToResults: true },
  { feedCode: 'gsde', lotteryCode: 'gsde', marketName: 'หุ้นเยอรมัน', parser: 'stock', syncToResults: true },
  { feedCode: 'gsuk', lotteryCode: 'gsuk', marketName: 'หุ้นอังกฤษ', parser: 'stock', syncToResults: true },
  { feedCode: 'gsus', lotteryCode: 'dowjones_vip', marketName: 'หุ้นดาวโจนส์', parser: 'stock', syncToResults: true },
  { feedCode: 'cqhn', lotteryCode: 'cqhn', marketName: 'ฮานอยเฉพาะกิจ', parser: 'simple', syncToResults: true },
  { feedCode: 'zcvip', lotteryCode: 'lao_vip', marketName: 'ลาว VIP', parser: 'simple', syncToResults: true },
  { feedCode: 'ynhn', lotteryCode: 'ynhn', marketName: 'ฮานอยธรรมดา', parser: 'simple', syncToResults: true },
  { feedCode: 'ynma', lotteryCode: 'ynma', marketName: 'มาเลย์', parser: 'simple', syncToResults: true }
];

const EXTRA_SYNC_CONFIGS = [
  { feedCode: 'gsb', lotteryCode: 'gsb', marketName: 'ออมสิน', parser: 'gsb', syncToResults: true, provider: 'gsb' }
];

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_pathana',
  lotteryCode: 'lao_pathana',
  marketName: '\u0e25\u0e32\u0e27\u0e1e\u0e31\u0e12\u0e19\u0e32',
  parser: 'laospathana',
  syncToResults: true,
  provider: 'laospathana'
});

const SYNC_CONFIGS = [...FEED_CONFIGS, ...EXTRA_SYNC_CONFIGS];
const isConfigMappingCovered = (config) => Boolean(
  config?.provider === 'gsb'
  || config?.provider === 'laospathana'
  || EXPLICIT_FEED_MAPPINGS[config?.feedCode]
);

const getFeedMappingMode = (configOrFeedCode) => {
  const config = typeof configOrFeedCode === 'string'
    ? SYNC_CONFIGS.find((item) => item.feedCode === configOrFeedCode) || { feedCode: configOrFeedCode }
    : configOrFeedCode || {};

  if (config.provider === 'gsb' || config.provider === 'laospathana') {
    return 'official-page';
  }

  return EXPLICIT_FEED_MAPPINGS[config.feedCode] ? 'explicit' : 'legacy-fallback';
};

const getMappingCoverageSummary = () => {
  const coveredConfigs = SYNC_CONFIGS.filter((config) => isConfigMappingCovered(config));
  const missingFeedCodes = SYNC_CONFIGS
    .filter((config) => !isConfigMappingCovered(config))
    .map((config) => config.feedCode);

  return {
    strictMode: STRICT_FEED_MAPPING,
    configuredCount: SYNC_CONFIGS.length,
    explicitCount: coveredConfigs.length,
    missingCount: missingFeedCodes.length,
    missingFeedCodes
  };
};

const syncState = {
  running: false,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  lastSummary: null
};

let autoSyncTimer = null;

const flattenValues = (value) => Array.isArray(value) ? value.flatMap(flattenValues) : [value];
const joinDigits = (value) => String(value || '').replace(/\D/g, '');
const uniqueDigits = (value) => [...new Set(flattenValues(value).map(joinDigits).filter(Boolean))];
const combineUniqueDigits = (...values) => [...new Set(values.flatMap((value) => uniqueDigits(value)).filter(Boolean))];
const tailDigits = (value, length) => {
  const digits = joinDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};
const twoDigitScalar = (value) => {
  const digits = joinDigits(value);
  return digits.length === 2 ? digits : '';
};
const middleDigits = (value, length) => {
  const digits = joinDigits(value);
  if (!digits) return '';
  if (digits.length <= length) return digits;
  const start = Math.floor((digits.length - length) / 2);
  return digits.slice(start, start + length);
};
const parseIssueToRoundCode = (value) => {
  const digits = joinDigits(value);
  if (digits.length < 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const parseBangkokDateTime = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  return createBangkokDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
};

const getValueByPath = (source, path) => path
  .split('.')
  .reduce((current, segment) => current == null ? undefined : current[segment], source);

const readMappedScalar = (row, fieldConfig) => {
  if (!fieldConfig?.path) return '';
  const value = getValueByPath(row, fieldConfig.path);
  return fieldConfig.transform ? fieldConfig.transform(value, row) : joinDigits(value);
};

const readMappedList = (row, fieldConfig) => {
  if (!fieldConfig?.path) return [];
  const value = getValueByPath(row, fieldConfig.path);
  const result = fieldConfig.transform ? fieldConfig.transform(value, row) : uniqueDigits(value);
  return Array.isArray(result) ? result.filter(Boolean) : uniqueDigits(result);
};

const toHeadline = (...candidates) => {
  for (const candidate of candidates) {
    const value = joinDigits(candidate);
    if (value) return value;
  }
  return '';
};

const buildRunDigits = (values) => [...new Set(values.join('').split('').filter(Boolean))];
const getSettlementSafety = (config) => Boolean(config.syncToResults);

const buildGovernmentSnapshot = (config, row, mapping = EXPLICIT_FEED_MAPPINGS[config.feedCode]) => {
  const firstPrize = readMappedScalar(row, mapping?.firstPrize) || joinDigits(row?.code?.code);
  const frontThreeHits = readMappedList(row, mapping?.threeFrontHits);
  const backThreeHits = readMappedList(row, mapping?.threeBottomHits);
  const twoBottom = readMappedScalar(row, mapping?.twoBottom) || joinDigits(row?.code?.code3);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, twoBottom),
      firstPrize,
      threeTop,
      threeFront: frontThreeHits[0] || '',
      twoTop,
      twoBottom,
      threeBottom: backThreeHits[0] || '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: frontThreeHits,
      threeBottomHits: backThreeHits,
      runTop: buildRunDigits(threeTop ? [threeTop] : []),
      runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row,
    legacyGovernmentPayload: {
      roundDate: parseIssueToRoundCode(row?.officialissue || row?.issue),
      firstPrize,
      threeTopList: frontThreeHits,
      threeBotList: backThreeHits,
      twoBottom,
      runTop: buildRunDigits(threeTop ? [threeTop] : []),
      runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
      fetchedAt: new Date()
    }
  };
};

const buildGenericSnapshot = (config, row, mapping) => {
  const firstPrize = readMappedScalar(row, mapping.firstPrize);
  const threeTop = readMappedScalar(row, mapping.threeTop);
  const threeFront = readMappedScalar(row, mapping.threeFront);
  const twoTop = readMappedScalar(row, mapping.twoTop);
  const twoBottom = readMappedScalar(row, mapping.twoBottom);
  const threeBottom = readMappedScalar(row, mapping.threeBottom);
  const threeTopHits = readMappedList(row, mapping.threeTopHits);
  const twoTopHits = readMappedList(row, mapping.twoTopHits);
  const twoBottomHits = readMappedList(row, mapping.twoBottomHits);
  const threeFrontHits = readMappedList(row, mapping.threeFrontHits);
  const threeBottomHits = readMappedList(row, mapping.threeBottomHits);
  const normalizedThreeTopHits = threeTopHits.length ? threeTopHits : (threeTop ? [threeTop] : []);
  const normalizedTwoTopHits = twoTopHits.length ? twoTopHits : (twoTop ? [twoTop] : []);
  const normalizedTwoBottomHits = twoBottomHits.length ? twoBottomHits : (twoBottom ? [twoBottom] : []);
  const normalizedThreeFrontHits = threeFrontHits.length ? threeFrontHits : (threeFront ? [threeFront] : []);
  const normalizedThreeBottomHits = threeBottomHits.length ? threeBottomHits : (threeBottom ? [threeBottom] : []);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
    headline: toHeadline(firstPrize, threeTop, twoBottom, twoTop),
    firstPrize,
    threeTop,
    threeFront,
    twoTop,
    twoBottom,
    threeBottom,
    threeTopHits: normalizedThreeTopHits,
    twoTopHits: normalizedTwoTopHits,
    twoBottomHits: normalizedTwoBottomHits,
    threeFrontHits: normalizedThreeFrontHits,
    threeBottomHits: normalizedThreeBottomHits,
    runTop: buildRunDigits(normalizedThreeTopHits),
    runBottom: buildRunDigits(normalizedTwoBottomHits),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildSimpleSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeTop = joinDigits(row?.code?.code_last3) || tailDigits(firstPrize, 3);
  const twoTop = joinDigits(row?.code?.code_last2) || tailDigits(firstPrize, 2);
  const twoBottom =
    tailDigits(row?.code?.code1, 2) ||
    twoDigitScalar(row?.code?.code2) ||
    joinDigits(row?.code?.code_pre2) ||
    joinDigits(row?.code?.code_mid2) ||
    '';

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, threeTop, twoBottom, twoTop),
      firstPrize,
      threeTop,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeTop ? [threeTop] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildStockSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeDigits = firstPrize;
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = joinDigits(row?.code?.code1);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, twoBottom, twoTop),
      firstPrize,
      threeTop: threeDigits,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeDigits ? [threeDigits] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeDigits ? [threeDigits] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildBaacSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = middleDigits(firstPrize, 2);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, threeTop, twoBottom),
      firstPrize,
      threeTop,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeTop ? [threeTop] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const snapshotBuilders = {
  government: buildGovernmentSnapshot,
  simple: buildSimpleSnapshot,
  stock: buildStockSnapshot,
  baac: buildBaacSnapshot
};

const fetchFeedRows = async (feedCode) => {
  const response = await axios.get(`${MANYCAI_FEED_BASE_URL}/${feedCode}.json`, {
    timeout: RESULT_SYNC_TIMEOUT_MS
  });

  if (!Array.isArray(response.data)) {
    throw new Error(`Unexpected feed payload for ${feedCode}`);
  }

  return response.data;
};

const fetchSyncRows = async (config) => {
  if (config.provider === 'gsb') {
    const snapshots = await fetchGsbSnapshots({ limit: GSB_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laospathana') {
    const snapshots = await fetchLaosPathanaSnapshots({ limit: LAOS_PATHANA_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  return fetchFeedRows(config.feedCode);
};

const buildSnapshot = (config, row, { strict = STRICT_FEED_MAPPING } = {}) => {
  if (config.provider === 'gsb' || config.provider === 'laospathana') {
    return row?.__snapshot || null;
  }

  const mapping = EXPLICIT_FEED_MAPPINGS[config.feedCode];
  if (!mapping && strict) {
    throw new Error(`Missing explicit mapping for feed ${config.feedCode}`);
  }
  if (mapping?.kind === 'government') {
    return buildGovernmentSnapshot(config, row, mapping);
  }
  if (mapping?.kind === 'generic') {
    return buildGenericSnapshot(config, row, mapping);
  }

  const builder = snapshotBuilders[config.parser];
  if (!builder) {
    throw new Error(`Parser "${config.parser}" is not supported`);
  }

  return builder(config, row);
};

const upsertSnapshot = async (snapshot, lotteryType) => {
  return MarketFeedResult.findOneAndUpdate(
    {
      feedCode: snapshot.feedCode,
      roundCode: snapshot.roundCode
    },
    {
      $set: {
        lotteryTypeId: lotteryType?._id || null,
        lotteryCode: snapshot.lotteryCode,
        marketName: snapshot.marketName,
        headline: snapshot.headline,
          firstPrize: snapshot.firstPrize,
          twoTop: snapshot.twoTop,
          twoBottom: snapshot.twoBottom,
          threeTop: snapshot.threeTop,
          threeFront: snapshot.threeFront,
          threeBottom: snapshot.threeBottom,
          threeTopHits: snapshot.threeTopHits,
          twoTopHits: snapshot.twoTopHits,
          twoBottomHits: snapshot.twoBottomHits,
          threeFrontHits: snapshot.threeFrontHits,
          threeBottomHits: snapshot.threeBottomHits,
        runTop: snapshot.runTop,
        runBottom: snapshot.runBottom,
        resultPublishedAt: snapshot.resultPublishedAt,
        isSettlementSafe: snapshot.isSettlementSafe,
        sourceUrl: snapshot.sourceUrl,
        rawPayload: snapshot.rawPayload
      }
    },
    {
      new: true,
      upsert: true
    }
  );
};

const upsertLegacyGovernmentResult = async (snapshot) => {
  const payload = snapshot.legacyGovernmentPayload;
  if (!payload?.roundDate || !payload.firstPrize) {
    return null;
  }

  const existing = await LotteryResult.findOne({ roundDate: payload.roundDate });
  if (existing) {
    Object.assign(existing, payload);
    return existing.save();
  }

  return LotteryResult.create(payload);
};

const syncSnapshotToResults = async (snapshot, lotteryType) => {
  if (!snapshot.isSettlementSafe || !lotteryType) {
    return { synced: false, settlement: null };
  }

  const round = await ensureRoundForLottery(lotteryType, snapshot.roundCode);
  if (!round) {
    throw new Error(`Round "${snapshot.roundCode}" not found for ${snapshot.lotteryCode}`);
  }

  await upsertRoundResult({
    roundId: round._id,
    lotteryTypeId: lotteryType._id,
    resultData: {
      headline: snapshot.headline,
        firstPrize: snapshot.firstPrize,
        threeTop: snapshot.threeTop,
        threeFront: snapshot.threeFront,
        twoTop: snapshot.twoTop,
        twoBottom: snapshot.twoBottom,
        threeBottom: snapshot.threeBottom,
        threeTopHits: snapshot.threeTopHits,
        twoTopHits: snapshot.twoTopHits,
        twoBottomHits: snapshot.twoBottomHits,
        threeFrontHits: snapshot.threeFrontHits,
        threeBottomHits: snapshot.threeBottomHits,
      runTop: snapshot.runTop,
      runBottom: snapshot.runBottom
    },
    sourceType: 'api',
    sourceUrl: snapshot.sourceUrl,
    isPublished: true
  });

  const settlement = await settleRoundById(round._id, { force: true });
  return { synced: true, settlement };
};

const syncLatestExternalResults = async () => {
  if (syncState.running) {
    return {
      skipped: true,
      reason: 'sync-already-running',
      ...syncState.lastSummary
    };
  }

  syncState.running = true;
  syncState.lastStartedAt = new Date().toISOString();
  syncState.lastError = null;

  try {
    const lotteryTypes = await LotteryType.find({
      code: { $in: SYNC_CONFIGS.map((config) => config.lotteryCode) }
    });
    const lotteryByCode = new Map(lotteryTypes.map((item) => [item.code, item]));
    const summary = {
      syncedAt: new Date().toISOString(),
      fetched: 0,
      savedSnapshots: 0,
      syncedResults: 0,
      settlements: 0,
      skipped: 0,
      warnings: [],
      strictMapping: STRICT_FEED_MAPPING,
      mappingCoverage: getMappingCoverageSummary(),
      feedSummaries: []
    };

    for (const config of SYNC_CONFIGS) {
      const feedSummary = {
        feedCode: config.feedCode,
        lotteryCode: config.lotteryCode,
        marketName: config.marketName,
        parser: config.parser,
        mappingMode: getFeedMappingMode(config),
        syncToResults: Boolean(config.syncToResults),
        fetchedRows: 0,
        processedRounds: 0,
        savedSnapshots: 0,
        syncedResults: 0,
        settlements: 0,
        warnings: [],
        status: 'ok',
        error: ''
      };
      summary.feedSummaries.push(feedSummary);

      try {
        const rows = await fetchSyncRows(config);
        feedSummary.fetchedRows = rows.length;
        if (!rows.length) {
          summary.skipped++;
          const warning = `No data in feed ${config.feedCode}`;
          summary.warnings.push(warning);
          feedSummary.warnings.push(warning);
          feedSummary.status = 'warning';
          continue;
        }

        const lotteryType = lotteryByCode.get(config.lotteryCode) || null;
        const processedRounds = new Set();

        for (const row of rows) {
          const snapshot = buildSnapshot(config, row);
          if (!snapshot.roundCode || !snapshot.headline || processedRounds.has(snapshot.roundCode)) {
            continue;
          }

          processedRounds.add(snapshot.roundCode);
          await upsertSnapshot(snapshot, lotteryType);
          summary.fetched++;
          summary.savedSnapshots++;
          feedSummary.savedSnapshots++;

          if (snapshot.lotteryCode === 'thai_government') {
            await upsertLegacyGovernmentResult(snapshot);
          }

          if (config.syncToResults) {
            const result = await syncSnapshotToResults(snapshot, lotteryType);
            if (result.synced) {
              summary.syncedResults++;
              feedSummary.syncedResults++;
            }
            if (result.settlement) {
              summary.settlements++;
              feedSummary.settlements++;
            }
          }
        }

        feedSummary.processedRounds = processedRounds.size;
        if (!processedRounds.size) {
          summary.skipped++;
          const warning = `Incomplete snapshot for ${config.feedCode}`;
          summary.warnings.push(warning);
          feedSummary.warnings.push(warning);
          feedSummary.status = 'warning';
        } else if (feedSummary.warnings.length) {
          feedSummary.status = 'warning';
        }
      } catch (error) {
        const warning = `${config.feedCode}: ${error.message}`;
        summary.warnings.push(warning);
        feedSummary.warnings.push(warning);
        feedSummary.status = 'error';
        feedSummary.error = error.message;
      }
    }

    summary.okFeeds = summary.feedSummaries.filter((feed) => feed.status === 'ok').length;
    summary.warningFeeds = summary.feedSummaries.filter((feed) => feed.status === 'warning').length;
    summary.errorFeeds = summary.feedSummaries.filter((feed) => feed.status === 'error').length;

    syncState.lastCompletedAt = new Date().toISOString();
    syncState.lastSummary = summary;
    return summary;
  } catch (error) {
    syncState.lastError = error.message;
    throw error;
  } finally {
    syncState.running = false;
  }
};

const getStoredLatestExternalResults = async ({ lotteryId = null, limit = 50 } = {}) => {
  const query = lotteryId ? { lotteryTypeId: lotteryId } : {};
  const items = await MarketFeedResult.find(query)
    .sort({ resultPublishedAt: -1, updatedAt: -1 })
    .limit(limit)
    .populate('lotteryTypeId', 'code name shortName provider');

  return items.map((item) => ({
    id: `feed-${item._id.toString()}`,
    lotteryTypeId: item.lotteryTypeId?._id?.toString() || item.lotteryTypeId?.toString() || null,
    lotteryCode: item.lotteryTypeId?.code || item.lotteryCode,
    lotteryName: item.lotteryTypeId?.name || item.marketName,
    lotteryShortName: item.lotteryTypeId?.shortName || '',
    provider: item.lotteryTypeId?.provider || 'ManyCai Feed',
    roundCode: item.roundCode,
    roundTitle: item.roundCode ? `งวด ${item.roundCode}` : '',
    drawAt: item.resultPublishedAt,
    resultPublishedAt: item.resultPublishedAt || item.updatedAt,
    headline: item.headline || item.firstPrize || item.twoBottom || '-',
      firstPrize: item.firstPrize || '',
      twoTop: item.twoTop || '',
      twoBottom: item.twoBottom || '',
      threeTop: item.threeTop || '',
      threeFront: item.threeFront || '',
      threeBottom: item.threeBottom || '',
      threeTopHits: item.threeTopHits || [],
      twoTopHits: item.twoTopHits || [],
      twoBottomHits: item.twoBottomHits || [],
      threeFrontHits: item.threeFrontHits || [],
      threeBottomHits: item.threeBottomHits || [],
    runTop: item.runTop || [],
    runBottom: item.runBottom || [],
    sourceType: 'api',
    sourceUrl: item.sourceUrl || '',
    isExternalSnapshot: true
  }));
};

const getExternalSyncState = () => ({
  ...syncState,
  feedBaseUrl: MANYCAI_FEED_BASE_URL,
  strictMapping: STRICT_FEED_MAPPING,
  mappingCoverage: getMappingCoverageSummary(),
  feeds: SYNC_CONFIGS.map((config) => ({
    feedCode: config.feedCode,
    lotteryCode: config.lotteryCode,
    marketName: config.marketName,
    parser: config.parser,
    syncToResults: Boolean(config.syncToResults),
    provider: config.provider || 'manycai',
    mappingMode: getFeedMappingMode(config)
  }))
});

const startExternalResultAutoSync = (intervalMs) => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }

  const runSync = async () => {
    try {
      const summary = await syncLatestExternalResults();
      console.log(`External result sync finished: ${JSON.stringify(summary)}`);
    } catch (error) {
      console.error('External result sync error:', error.message);
      syncState.lastError = error.message;
    }
  };

  runSync();
  autoSyncTimer = setInterval(runSync, intervalMs);
  return autoSyncTimer;
};

const fetchThaiGovernmentResultByRoundCode = async (roundCode) => {
  const config = FEED_CONFIGS.find((item) => item.feedCode === 'tgfc');
  const rows = await fetchFeedRows('tgfc');
  const row = rows.find((item) => parseIssueToRoundCode(item.officialissue || item.issue) === roundCode);
  if (!row || !config) {
    return null;
  }

  const snapshot = buildGovernmentSnapshot(config, row);
  return snapshot.legacyGovernmentPayload;
};

module.exports = {
  MANYCAI_FEED_BASE_URL,
  FEED_CONFIGS,
  SYNC_CONFIGS,
  EXPLICIT_FEED_MAPPINGS,
  STRICT_FEED_MAPPING,
  buildSnapshot,
  fetchFeedRows,
  fetchThaiGovernmentResultByRoundCode,
  syncLatestExternalResults,
  startExternalResultAutoSync,
  getStoredLatestExternalResults,
  getExternalSyncState
};
