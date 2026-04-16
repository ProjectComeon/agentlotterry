const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const LAOS_PROVIDER_NAME = 'Huay Lao Official';
const LAOS_MARKET_ID = 'tlzc';
const LAOS_MARKET_NAME = '\u0e2b\u0e27\u0e22\u0e25\u0e32\u0e27';
const LAOS_SITE_URL = 'https://huaylao.la/';
const LAOS_HISTORY_URL = `${LAOS_SITE_URL}wp-json/wp/v2/llcc_result`;
const LAOS_TIMEOUT_MS = Number(process.env.LAOS_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: LAOS_TIMEOUT_MS,
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

const prefixDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(0, length);
};

const buildPublishedAt = (roundCode, drawTime) => {
  const dateMatch = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(drawTime || '').match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  return createBangkokDate(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0
  );
};

const buildSnapshot = ({ row }) => {
  const meta = row?.meta || {};
  const roundCode = stringValue(meta.llcc_draw_date);
  const firstPrize = compactDigits(meta.llcc_four);
  const threeTop = compactDigits(meta.llcc_three);
  const twoTop = compactDigits(meta.llcc_two);
  const twoBottom = prefixDigits(firstPrize, 2);

  if (!roundCode || !firstPrize || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: LAOS_MARKET_ID,
    feedCode: 'tlzc',
    marketName: LAOS_MARKET_NAME,
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
    resultPublishedAt: buildPublishedAt(roundCode, meta.llcc_draw_time),
    isSettlementSafe: true,
    sourceUrl: row?.link || LAOS_SITE_URL,
    rawPayload: row
  };
};

const fetchLaosSnapshots = async ({ limit = 10 } = {}) => {
  const perPage = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const response = await http.get(LAOS_HISTORY_URL, {
    params: {
      per_page: perPage,
      page: 1
    }
  });
  const rows = Array.isArray(response.data) ? response.data : [];

  return rows
    .map((row) => buildSnapshot({ row }))
    .filter(Boolean)
    .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
    .slice(0, Math.max(1, Number(limit) || 1));
};

const fetchLatestLaosSnapshot = async () => {
  const snapshots = await fetchLaosSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  LAOS_PROVIDER_NAME,
  LAOS_MARKET_ID,
  LAOS_MARKET_NAME,
  LAOS_SITE_URL,
  fetchLaosSnapshots,
  fetchLatestLaosSnapshot
};
