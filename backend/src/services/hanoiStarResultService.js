const axios = require('axios');
const { createBangkokDate, formatBangkokDate } = require('../utils/bangkokTime');

const HANOI_STAR_PROVIDER_NAME = 'Minh Ngoc Star Official';
const HANOI_STAR_MARKET_ID = 'hanoi_star';
const HANOI_STAR_MARKET_NAME = 'ฮานอยสตาร์';
const HANOI_STAR_SITE_URL = 'https://minhngocstar.com/';
const HANOI_STAR_RESULT_URL = 'https://api.minhngocstar.com/result';
const HANOI_STAR_TIMEOUT_MS = Number(process.env.HANOI_STAR_TIMEOUT_MS || 15000);
const HANOI_STAR_HISTORY_WINDOW_DAYS = Number(process.env.HANOI_STAR_HISTORY_WINDOW_DAYS || 45);

const http = axios.create({
  timeout: HANOI_STAR_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 Codex AdminAgentLotterry'
  }
});

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const compactDigits = (value) => stringValue(value).replace(/\D/g, '');
const uniqueDigits = (value) => [...new Set(compactDigits(value).split('').filter(Boolean))];

const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};

const parseBangkokDateTime = (value) => {
  const normalized = stringValue(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return createBangkokDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
};

const buildSnapshot = ({ roundCode, results, publishedAt, rawPayload }) => {
  const firstPrize = compactDigits(results?.prize_1st);
  const secondPrize = compactDigits(results?.prize_2nd);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = tailDigits(secondPrize, 2);

  if (!roundCode || !firstPrize || !secondPrize || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: HANOI_STAR_MARKET_ID,
    feedCode: HANOI_STAR_MARKET_ID,
    marketName: HANOI_STAR_MARKET_NAME,
    roundCode,
    headline: threeTop,
    firstPrize,
    threeTop,
    threeFront: '',
    twoTop,
    twoBottom,
    threeBottom: '',
    threeTopHits: [threeTop],
    twoTopHits: [twoTop],
    twoBottomHits: [twoBottom],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: uniqueDigits(threeTop),
    runBottom: uniqueDigits(twoBottom),
    resultPublishedAt: publishedAt || null,
    isSettlementSafe: true,
    sourceUrl: HANOI_STAR_SITE_URL,
    rawPayload
  };
};

const fetchSnapshotByPath = async (pathSuffix = '') => {
  const response = await http.get(`${HANOI_STAR_RESULT_URL}${pathSuffix}`);
  const payload = response.data?.data;

  if (!payload) {
    return null;
  }

  return buildSnapshot({
    roundCode: stringValue(payload?.lotto_date),
    results: payload?.results,
    publishedAt: parseBangkokDateTime(payload?.show_1st) || parseBangkokDateTime(response.data?.update),
    rawPayload: response.data
  });
};

const fetchCurrentSnapshot = async () => fetchSnapshotByPath('');

const fetchSnapshotByRoundCode = async (roundCode) => {
  const snapshot = await fetchSnapshotByPath(`/${roundCode}`);
  if (!snapshot || snapshot.roundCode !== roundCode) {
    return null;
  }
  return snapshot;
};

const parseRoundCodeToDate = (roundCode) => {
  const match = stringValue(roundCode).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const fetchHistorySnapshots = async ({ limit = 10, latestRoundCode = '' } = {}) => {
  const latestDate = parseRoundCodeToDate(latestRoundCode) || new Date();
  const snapshots = [];

  for (let offset = 1; offset <= HANOI_STAR_HISTORY_WINDOW_DAYS && snapshots.length < limit; offset += 1) {
    const targetDate = new Date(latestDate.getTime() - offset * 24 * 60 * 60 * 1000);
    const roundCode = formatBangkokDate(targetDate);
    const snapshot = await fetchSnapshotByRoundCode(roundCode);

    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
};

const fetchHanoiStarSnapshots = async ({ limit = 10 } = {}) => {
  const currentSnapshot = await fetchCurrentSnapshot();
  const historySnapshots = await fetchHistorySnapshots({
    limit: Math.max(0, (Number(limit) || 1) - (currentSnapshot ? 1 : 0)),
    latestRoundCode: currentSnapshot?.roundCode
  });
  const byRoundCode = new Map();

  [currentSnapshot, ...historySnapshots].filter(Boolean).forEach((snapshot) => {
    if (!byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, snapshot);
    }
  });

  return [...byRoundCode.values()]
    .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
    .slice(0, Math.max(1, Number(limit) || 1));
};

const fetchLatestHanoiStarSnapshot = async () => {
  const snapshots = await fetchHanoiStarSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  HANOI_STAR_PROVIDER_NAME,
  HANOI_STAR_MARKET_ID,
  HANOI_STAR_MARKET_NAME,
  HANOI_STAR_SITE_URL,
  fetchHanoiStarSnapshots,
  fetchLatestHanoiStarSnapshot
};
