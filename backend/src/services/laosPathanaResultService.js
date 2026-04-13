const axios = require('axios');
const {
  createBangkokDate,
  formatBangkokDate
} = require('../utils/bangkokTime');

const LAOS_PATHANA_PROVIDER_NAME = 'Lao Pathana Official';
const LAOS_PATHANA_MARKET_ID = 'lao_pathana';
const LAOS_PATHANA_MARKET_NAME = '\u0e25\u0e32\u0e27\u0e1e\u0e31\u0e12\u0e19\u0e32';
const LAOS_PATHANA_SITE_URL = 'https://laospathana.com/';
const LAOS_PATHANA_TEAM_URL = `${LAOS_PATHANA_SITE_URL}act/glotteam`;
const LAOS_PATHANA_CURRENT_MATCH_URL = `${LAOS_PATHANA_SITE_URL}act/glotcurmatch`;
const LAOS_PATHANA_RESULT_URL = `${LAOS_PATHANA_SITE_URL}act/glotresult`;
const LAOS_PATHANA_HISTORY_URL = `${LAOS_PATHANA_SITE_URL}act/glotresulthis`;
const LAOS_PATHANA_TIMEOUT_MS = Number(process.env.LAOS_PATHANA_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: LAOS_PATHANA_TIMEOUT_MS,
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

const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};

const middleDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  if (digits.length <= length) return digits;
  const start = Math.floor((digits.length - length) / 2);
  return digits.slice(start, start + length);
};

const uniqueDigits = (value) => [...new Set(compactDigits(value).split('').filter(Boolean))];

const parseRoundCode = (value) => {
  const normalized = stringValue(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return formatBangkokDate(parsed);
};

const parseBangkokDateTime = (value) => {
  const normalized = stringValue(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (match) {
    return createBangkokDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSnapshot = ({ roundCode, result1, publishedAt, rawPayload }) => {
  const firstPrize = compactDigits(result1);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = middleDigits(firstPrize, 2);

  if (!roundCode || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: LAOS_PATHANA_MARKET_ID,
    feedCode: LAOS_PATHANA_MARKET_ID,
    marketName: LAOS_PATHANA_MARKET_NAME,
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
    sourceUrl: LAOS_PATHANA_SITE_URL,
    rawPayload
  };
};

const fetchLaosPathanaTeam = async () => {
  const response = await http.get(LAOS_PATHANA_TEAM_URL);
  return Array.isArray(response.data?.dat) ? response.data.dat[0] || null : null;
};

const fetchCurrentSnapshot = async () => {
  const currentMatchResponse = await http.get(LAOS_PATHANA_CURRENT_MATCH_URL);
  const currentMatch = currentMatchResponse.data?.dat;

  if (!currentMatch?.MATCH_ID) {
    return null;
  }

  const currentResultResponse = await http.get(`${LAOS_PATHANA_RESULT_URL}?mtid=${currentMatch.MATCH_ID}`);
  const currentResult = currentResultResponse.data?.dat;
  const roundCode = parseRoundCode(currentMatch.M_DATE || currentMatch.MATCH_DATE);
  const publishedAt =
    parseBangkokDateTime(currentMatchResponse.data?.dat1?.SPINTIME)
    || parseBangkokDateTime(currentMatch.SPINTIME)
    || null;

  return buildSnapshot({
    roundCode,
    result1: currentResult?.RESULT_1,
    publishedAt,
    rawPayload: {
      currentMatch,
      currentResult
    }
  });
};

const fetchHistorySnapshots = async () => {
  const historyResponse = await http.get(LAOS_PATHANA_HISTORY_URL);
  const rows = Array.isArray(historyResponse.data?.dat) ? historyResponse.data.dat : [];

  return rows
    .map((row) => buildSnapshot({
      roundCode: parseRoundCode(row.MATCH_DATE),
      result1: row.RESULT_1,
      publishedAt: parseBangkokDateTime(row.UPDATE_TIME),
      rawPayload: row
    }))
    .filter(Boolean);
};

const fetchLaosPathanaSnapshots = async ({ limit = 10 } = {}) => {
  const [teamInfoResult, currentSnapshotResult, historySnapshotsResult] = await Promise.allSettled([
    fetchLaosPathanaTeam(),
    fetchCurrentSnapshot(),
    fetchHistorySnapshots()
  ]);
  const teamInfo = teamInfoResult.status === 'fulfilled' ? teamInfoResult.value : null;
  const currentSnapshot = currentSnapshotResult.status === 'fulfilled' ? currentSnapshotResult.value : null;
  const historySnapshots = historySnapshotsResult.status === 'fulfilled' ? historySnapshotsResult.value : [];

  const byRoundCode = new Map();

  [currentSnapshot, ...historySnapshots].filter(Boolean).forEach((snapshot) => {
    if (!byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, {
        ...snapshot,
        rawPayload: {
          ...(snapshot.rawPayload || {}),
          teamInfo
        }
      });
    }
  });

  return [...byRoundCode.values()]
    .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
    .slice(0, Math.max(1, Number(limit) || 1));
};

const fetchLatestLaosPathanaSnapshot = async () => {
  const snapshots = await fetchLaosPathanaSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  LAOS_PATHANA_PROVIDER_NAME,
  LAOS_PATHANA_MARKET_ID,
  LAOS_PATHANA_MARKET_NAME,
  LAOS_PATHANA_SITE_URL,
  fetchLaosPathanaTeam,
  fetchLaosPathanaSnapshots,
  fetchLatestLaosPathanaSnapshot
};
