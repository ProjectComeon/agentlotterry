const axios = require('axios');
const {
  createBangkokDate,
  getBangkokParts
} = require('../utils/bangkokTime');

const THAI_GOV_PROVIDER_NAME = 'GLO Official';
const THAI_GOV_MARKET_ID = 'thai-government';
const THAI_GOV_LOTTERY_CODE = 'thai_government';
const THAI_GOV_FEED_CODE = 'tgfc';
const THAI_GOV_MARKET_NAME = 'รัฐบาลไทย';
const THAI_GOV_CHECKING_URL = 'https://www.glo.or.th/lottery/checking';
const THAI_GOV_LATEST_URL = 'https://www.glo.or.th/api/lottery/getLatestLottery';
const THAI_GOV_YEAR_URL = 'https://www.glo.or.th/api/lottery/getLotteryResultByYear';
const THAI_GOV_TIMEOUT_MS = Number(process.env.THAI_GOV_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: THAI_GOV_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 Codex AdminAgentLotterry',
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json'
  }
});

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const compactDigits = (value) => stringValue(value).replace(/\D/g, '');

const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};

const uniqueDigits = (value) => [...new Set(compactDigits(value).split('').filter(Boolean))];

const uniqueList = (values) => [...new Set((values || []).map(compactDigits).filter(Boolean))];

const firstScalar = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const scalar = firstScalar(item);
      if (scalar) return scalar;
    }
    return '';
  }

  if (value && typeof value === 'object') {
    return compactDigits(value.value || value.number || value.prize || '');
  }

  return compactDigits(value);
};

const listScalars = (value) => {
  if (Array.isArray(value)) {
    return uniqueList(
      value.flatMap((item) => {
        if (Array.isArray(item)) return listScalars(item);
        if (item && typeof item === 'object') return firstScalar(item);
        return compactDigits(item);
      })
    );
  }

  if (value && typeof value === 'object') {
    return uniqueList([firstScalar(value)]);
  }

  return uniqueList([compactDigits(value)]);
};

const parseRoundCode = (value) => {
  const normalized = stringValue(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return '';
};

const toPublishedAt = (roundCode) => {
  const match = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return createBangkokDate(Number(match[1]), Number(match[2]), Number(match[3]), 16, 0, 0);
};

const toSourceUrl = (roundCode, pdfUrl) => stringValue(pdfUrl) || `${THAI_GOV_CHECKING_URL}?date=${roundCode}`;

const buildSnapshot = ({
  roundCode,
  firstPrize,
  threeFrontHits,
  threeBottomHits,
  twoBottom,
  sourceUrl,
  rawPayload
}) => {
  const normalizedRoundCode = parseRoundCode(roundCode);
  const normalizedFirstPrize = compactDigits(firstPrize);
  const normalizedTwoBottom = compactDigits(twoBottom);
  const normalizedThreeFrontHits = uniqueList(threeFrontHits);
  const normalizedThreeBottomHits = uniqueList(threeBottomHits);
  const threeTop = tailDigits(normalizedFirstPrize, 3);
  const twoTop = tailDigits(normalizedFirstPrize, 2);

  if (!normalizedRoundCode || !normalizedFirstPrize || !normalizedTwoBottom) {
    return null;
  }

  return {
    lotteryCode: THAI_GOV_LOTTERY_CODE,
    feedCode: THAI_GOV_FEED_CODE,
    marketName: THAI_GOV_MARKET_NAME,
    roundCode: normalizedRoundCode,
    headline: normalizedFirstPrize,
    firstPrize: normalizedFirstPrize,
    threeTop,
    threeFront: normalizedThreeFrontHits[0] || '',
    twoTop,
    twoBottom: normalizedTwoBottom,
    threeBottom: normalizedThreeBottomHits[0] || '',
    threeTopHits: threeTop ? [threeTop] : [],
    twoTopHits: twoTop ? [twoTop] : [],
    twoBottomHits: normalizedTwoBottom ? [normalizedTwoBottom] : [],
    threeFrontHits: normalizedThreeFrontHits,
    threeBottomHits: normalizedThreeBottomHits,
    runTop: uniqueDigits(threeTop),
    runBottom: uniqueDigits(normalizedTwoBottom),
    resultPublishedAt: toPublishedAt(normalizedRoundCode),
    isSettlementSafe: true,
    sourceUrl: toSourceUrl(normalizedRoundCode, sourceUrl),
    rawPayload,
    legacyGovernmentPayload: {
      roundDate: normalizedRoundCode,
      firstPrize: normalizedFirstPrize,
      threeTopList: normalizedThreeFrontHits,
      threeBotList: normalizedThreeBottomHits,
      twoBottom: normalizedTwoBottom,
      runTop: uniqueDigits(threeTop),
      runBottom: uniqueDigits(normalizedTwoBottom),
      fetchedAt: new Date()
    }
  };
};

const fetchLatestThaiGovernmentMeta = async () => {
  const response = await http.post(THAI_GOV_LATEST_URL, {});
  return response.data?.response || null;
};

const fetchThaiGovernmentYearSnapshots = async (year) => {
  const response = await http.post(THAI_GOV_YEAR_URL, { year: Number(year) });
  const rows = Array.isArray(response.data?.response) ? response.data.response : [];

  return rows
    .map((row) => buildSnapshot({
      roundCode: row.date,
      firstPrize: firstScalar(row?.data?.first),
      threeFrontHits: listScalars(row?.data?.last3f),
      threeBottomHits: listScalars(row?.data?.last3b),
      twoBottom: firstScalar(row?.data?.last2),
      sourceUrl: '',
      rawPayload: row
    }))
    .filter(Boolean);
};

const fetchThaiGovernmentSnapshots = async ({ limit = 10 } = {}) => {
  const currentYear = getBangkokParts(new Date()).year;
  const years = [currentYear, currentYear - 1];
  const latestMetaPromise = fetchLatestThaiGovernmentMeta().catch(() => null);
  const yearSnapshots = await Promise.all(years.map((year) => fetchThaiGovernmentYearSnapshots(year).catch(() => [])));
  const latestMeta = await latestMetaPromise;
  const byRoundCode = new Map();

  yearSnapshots.flat().filter(Boolean).forEach((snapshot) => {
    if (!byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, snapshot);
      return;
    }

    const existing = byRoundCode.get(snapshot.roundCode);
    if (!existing?.sourceUrl && snapshot.sourceUrl) {
      byRoundCode.set(snapshot.roundCode, snapshot);
    }
  });

  const latestMetaRoundCode = parseRoundCode(latestMeta?.date);
  if (latestMetaRoundCode && byRoundCode.has(latestMetaRoundCode)) {
    const latestSnapshot = byRoundCode.get(latestMetaRoundCode);
    byRoundCode.set(latestMetaRoundCode, {
      ...latestSnapshot,
      rawPayload: {
        ...(latestSnapshot?.rawPayload || {}),
        latestMeta
      }
    });
  }

  return [...byRoundCode.values()]
    .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
    .slice(0, Math.max(1, Number(limit) || 1));
};

const fetchLatestThaiGovernmentSnapshot = async () => {
  const snapshots = await fetchThaiGovernmentSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

const fetchThaiGovernmentSnapshotByRoundCode = async (roundCode) => {
  const normalizedRoundCode = parseRoundCode(roundCode);
  if (!normalizedRoundCode) return null;

  const targetYear = Number(normalizedRoundCode.slice(0, 4));
  const snapshots = await fetchThaiGovernmentYearSnapshots(targetYear);
  return snapshots.find((snapshot) => snapshot.roundCode === normalizedRoundCode) || null;
};

module.exports = {
  THAI_GOV_PROVIDER_NAME,
  THAI_GOV_MARKET_ID,
  THAI_GOV_LOTTERY_CODE,
  THAI_GOV_FEED_CODE,
  THAI_GOV_MARKET_NAME,
  THAI_GOV_CHECKING_URL,
  fetchLatestThaiGovernmentSnapshot,
  fetchThaiGovernmentSnapshots,
  fetchThaiGovernmentSnapshotByRoundCode
};
