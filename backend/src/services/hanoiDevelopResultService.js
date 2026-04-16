const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const HANOI_DEVELOP_PROVIDER_NAME = 'Xoso Develop Official';
const HANOI_DEVELOP_MARKET_ID = 'hanoi_develop';
const HANOI_DEVELOP_MARKET_NAME = 'ฮานอยพัฒนา';
const HANOI_DEVELOP_SITE_URL = 'https://xosodevelop.com/';
const HANOI_DEVELOP_RESULT_URL = 'https://api.xosodevelop.com/api/result';
const HANOI_DEVELOP_HISTORY_URL = 'https://api.xosodevelop.com/api/history';
const HANOI_DEVELOP_TIMEOUT_MS = Number(process.env.HANOI_DEVELOP_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: HANOI_DEVELOP_TIMEOUT_MS,
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
    lotteryCode: HANOI_DEVELOP_MARKET_ID,
    feedCode: HANOI_DEVELOP_MARKET_ID,
    marketName: HANOI_DEVELOP_MARKET_NAME,
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
    sourceUrl: HANOI_DEVELOP_SITE_URL,
    rawPayload
  };
};

const fetchCurrentSnapshot = async () => {
  const response = await http.get(HANOI_DEVELOP_RESULT_URL);
  const payload = response.data?.data;

  return buildSnapshot({
    roundCode: stringValue(payload?.lotto_date),
    results: payload?.results,
    publishedAt: parseBangkokDateTime(payload?.show_1st) || parseBangkokDateTime(response.data?.update),
    rawPayload: response.data
  });
};

const fetchHistorySnapshots = async () => {
  const response = await http.get(HANOI_DEVELOP_HISTORY_URL);
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];

  return rows
    .map((row) => buildSnapshot({
      roundCode: stringValue(row?.lotto_date),
      results: row?.results,
      publishedAt: parseBangkokDateTime(`${stringValue(row?.lotto_date)} 19:30:00`),
      rawPayload: row
    }))
    .filter(Boolean);
};

const fetchHanoiDevelopSnapshots = async ({ limit = 10 } = {}) => {
  const [currentSnapshotResult, historySnapshotsResult] = await Promise.allSettled([
    fetchCurrentSnapshot(),
    fetchHistorySnapshots()
  ]);

  const currentSnapshot = currentSnapshotResult.status === 'fulfilled' ? currentSnapshotResult.value : null;
  const historySnapshots = historySnapshotsResult.status === 'fulfilled' ? historySnapshotsResult.value : [];
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

const fetchLatestHanoiDevelopSnapshot = async () => {
  const snapshots = await fetchHanoiDevelopSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  HANOI_DEVELOP_PROVIDER_NAME,
  HANOI_DEVELOP_MARKET_ID,
  HANOI_DEVELOP_MARKET_NAME,
  HANOI_DEVELOP_SITE_URL,
  fetchHanoiDevelopSnapshots,
  fetchLatestHanoiDevelopSnapshot
};
