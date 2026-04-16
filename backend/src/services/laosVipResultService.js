const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const LAOS_VIP_PROVIDER_NAME = 'Lao VIP Official';
const LAOS_VIP_MARKET_ID = 'lao_vip';
const LAOS_VIP_MARKET_NAME = '\u0e25\u0e32\u0e27 VIP';
const LAOS_VIP_SITE_URL = 'https://www.laosviplot.com/';
const LAOS_VIP_RESULT_URL = `${LAOS_VIP_SITE_URL}result`;
const LAOS_VIP_HISTORY_URL = `${LAOS_VIP_SITE_URL}lastlottery`;
const LAOS_VIP_TIMEOUT_MS = Number(process.env.LAOS_VIP_TIMEOUT_MS || 15000);
const LAOS_VIP_DRAW_HOUR = 21;
const LAOS_VIP_DRAW_MINUTE = 30;

const http = axios.create({
  timeout: LAOS_VIP_TIMEOUT_MS,
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

const parseSlashDate = (value) => {
  const normalized = stringValue(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const buildPublishedAt = (roundCode) => {
  const match = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return createBangkokDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    LAOS_VIP_DRAW_HOUR,
    LAOS_VIP_DRAW_MINUTE,
    0
  );
};

const buildSnapshot = ({ roundCode, firstPrize, rawPayload }) => {
  const normalizedRoundCode = parseSlashDate(roundCode) || stringValue(roundCode);
  const normalizedFirstPrize = compactDigits(firstPrize);
  const threeTop = normalizedFirstPrize.slice(-3);
  const twoTop = normalizedFirstPrize.slice(-2);
  const twoBottom = normalizedFirstPrize.slice(0, 2);

  if (!normalizedRoundCode || !normalizedFirstPrize || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: LAOS_VIP_MARKET_ID,
    feedCode: 'zcvip',
    marketName: LAOS_VIP_MARKET_NAME,
    roundCode: normalizedRoundCode,
    headline: threeTop,
    firstPrize: normalizedFirstPrize,
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
    resultPublishedAt: buildPublishedAt(normalizedRoundCode),
    isSettlementSafe: true,
    sourceUrl: LAOS_VIP_SITE_URL,
    rawPayload
  };
};

const fetchCurrentSnapshot = async () => {
  const response = await http.get(LAOS_VIP_RESULT_URL);
  const payload = response.data || {};
  const firstPrize = compactDigits([
    payload.lotto_0,
    payload.lotto_1,
    payload.lotto_2,
    payload.lotto_3,
    payload.lotto_4
  ].join(''));

  return buildSnapshot({
    roundCode: payload.date,
    firstPrize,
    rawPayload: payload
  });
};

const fetchHistorySnapshots = async () => {
  const response = await http.get(LAOS_VIP_HISTORY_URL);
  const rows = Array.isArray(response.data) ? response.data : [];

  return rows
    .map((row) => buildSnapshot({
      roundCode: row?.DATE,
      firstPrize: row?.NUMBER,
      rawPayload: row
    }))
    .filter(Boolean);
};

const fetchLaosVipSnapshots = async ({ limit = 10 } = {}) => {
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

const fetchLatestLaosVipSnapshot = async () => {
  const snapshots = await fetchLaosVipSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  LAOS_VIP_PROVIDER_NAME,
  LAOS_VIP_MARKET_ID,
  LAOS_VIP_MARKET_NAME,
  LAOS_VIP_SITE_URL,
  fetchLaosVipSnapshots,
  fetchLatestLaosVipSnapshot
};
