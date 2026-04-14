const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const LAOS_TV_PROVIDER_NAME = 'Lao TV Official';
const LAOS_TV_MARKET_ID = 'lao_tv';
const LAOS_TV_MARKET_NAME = '\u0e25\u0e32\u0e27 TV';
const LAOS_TV_SITE_URL = 'https://lao-tv.com/';
const LAOS_TV_RESULT_URL = 'https://api.lao-tv.com/result';
const LAOS_TV_HISTORY_URL = 'https://api.lao-tv.com/history';
const LAOS_TV_TIMEOUT_MS = Number(process.env.LAOS_TV_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: LAOS_TV_TIMEOUT_MS,
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
  const digit5 = compactDigits(results?.digit5);
  const threeTop = compactDigits(results?.digit3);
  const twoTop = compactDigits(results?.digit2_top);
  const twoBottom = compactDigits(results?.digit2_bottom);

  if (!roundCode || !digit5 || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: LAOS_TV_MARKET_ID,
    feedCode: LAOS_TV_MARKET_ID,
    marketName: LAOS_TV_MARKET_NAME,
    roundCode,
    headline: threeTop,
    firstPrize: digit5,
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
    sourceUrl: LAOS_TV_SITE_URL,
    rawPayload
  };
};

const fetchCurrentSnapshot = async () => {
  const response = await http.get(LAOS_TV_RESULT_URL);
  const payload = response.data?.data;

  return buildSnapshot({
    roundCode: stringValue(payload?.lotto_date),
    results: payload?.results,
    publishedAt: parseBangkokDateTime(payload?.show_result) || parseBangkokDateTime(response.data?.update),
    rawPayload: response.data
  });
};

const fetchHistorySnapshots = async () => {
  const response = await http.get(LAOS_TV_HISTORY_URL);
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];

  return rows
    .map((row) => buildSnapshot({
      roundCode: stringValue(row?.lotto_date),
      results: row?.results,
      publishedAt: parseBangkokDateTime(`${stringValue(row?.lotto_date)} 10:30:00`),
      rawPayload: row
    }))
    .filter(Boolean);
};

const fetchLaosTvSnapshots = async ({ limit = 10 } = {}) => {
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

const fetchLatestLaosTvSnapshot = async () => {
  const snapshots = await fetchLaosTvSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  LAOS_TV_PROVIDER_NAME,
  LAOS_TV_MARKET_ID,
  LAOS_TV_MARKET_NAME,
  LAOS_TV_SITE_URL,
  fetchLaosTvSnapshots,
  fetchLatestLaosTvSnapshot
};
