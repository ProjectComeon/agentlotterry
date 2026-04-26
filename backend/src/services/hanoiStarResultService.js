const axios = require('axios');
const { createBangkokDate, formatBangkokDate } = require('../utils/bangkokTime');

const HANOI_STAR_PROVIDER_NAME = 'Hanoi Star Official Sources';
const HANOI_STAR_MARKET_ID = 'hanoi_star';
const HANOI_STAR_MARKET_NAME = 'ฮานอยสตาร์';
const HANOI_STAR_SITE_URL = process.env.HANOI_STAR_SITE_URL || 'https://exphuay.com/result/minhngocstar';
const HANOI_STAR_HISTORY_URL = process.env.HANOI_STAR_HISTORY_URL || 'https://exphuay.com/backward/minhngocstar';
const HANOI_STAR_SIAMGLO_URL = process.env.HANOI_STAR_SIAMGLO_URL || 'https://siamglo.com/lotto_stat/12';
const HANOI_STAR_TIMEOUT_MS = Number(process.env.HANOI_STAR_TIMEOUT_MS || 15000);

const RESULT_ENTRY_PATTERN = /lottosName:"minhngocstar"[\s\S]{0,500}?lottosDate:"([^"]+)"[\s\S]{0,300}?lottosTime:"([^"]+)"[\s\S]{0,300}?lottosNumber:"([^"]+)"[\s\S]{0,200}?lottosUnder:"([^"]+)"/g;
const SIAMGLO_RESULT_ROW_PATTERN = /<tr\b[^>]*data-month="[^"]*"[^>]*>[\s\S]*?<span class="text-white fw-bold">\s*([^<]+?)\s*<\/span>[\s\S]*?<span class="num-3">([^<]+)<\/span>[\s\S]*?<span class="num-2">([^<]+)<\/span>[\s\S]*?<span class="num-full">([^<]+)<\/span>[\s\S]*?<\/tr>/g;
const SIAMGLO_DRAW_TIME = '12:30';
const THAI_MONTHS = {
  'ม.ค.': 1,
  'มกราคม': 1,
  'ก.พ.': 2,
  'กุมภาพันธ์': 2,
  'มี.ค.': 3,
  'มีนาคม': 3,
  'เม.ย.': 4,
  'เมษายน': 4,
  'พ.ค.': 5,
  'พฤษภาคม': 5,
  'มิ.ย.': 6,
  'มิถุนายน': 6,
  'ก.ค.': 7,
  'กรกฎาคม': 7,
  'ส.ค.': 8,
  'สิงหาคม': 8,
  'ก.ย.': 9,
  'กันยายน': 9,
  'ต.ค.': 10,
  'ตุลาคม': 10,
  'พ.ย.': 11,
  'พฤศจิกายน': 11,
  'ธ.ค.': 12,
  'ธันวาคม': 12
};

const http = axios.create({
  timeout: HANOI_STAR_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://exphuay.com/'
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

const parseRoundCode = (value) => {
  const normalized = stringValue(value);

  if (/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return formatBangkokDate(parsed);
    }
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const parseThaiRoundDate = (value) => {
  const normalized = stringValue(value).replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})$/u);
  if (!match) return '';

  const day = Number(match[1]);
  const month = THAI_MONTHS[match[2]];
  const buddhistYear = Number(match[3]);
  const year = buddhistYear > 2400 ? buddhistYear - 543 : buddhistYear;

  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parsePublishedAt = (roundCode, drawTime) => {
  const dateMatch = stringValue(roundCode).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = stringValue(drawTime).match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  return createBangkokDate(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0
  );
};

const buildSnapshot = ({ roundCode, drawTime, firstPrize, twoBottom, sourceUrl }) => {
  const normalizedRoundCode = parseRoundCode(roundCode);
  const firstPrizeDigits = compactDigits(firstPrize);
  const twoBottomDigits = compactDigits(twoBottom);
  const threeTop = tailDigits(firstPrizeDigits, 3);
  const twoTop = tailDigits(firstPrizeDigits, 2);

  if (!normalizedRoundCode || !firstPrizeDigits || !threeTop || !twoTop || !twoBottomDigits) {
    return null;
  }

  return {
    lotteryCode: HANOI_STAR_MARKET_ID,
    feedCode: HANOI_STAR_MARKET_ID,
    marketName: HANOI_STAR_MARKET_NAME,
    roundCode: normalizedRoundCode,
    headline: threeTop,
    firstPrize: firstPrizeDigits,
    threeTop,
    threeFront: '',
    twoTop,
    twoBottom: twoBottomDigits,
    threeBottom: '',
    threeTopHits: [threeTop],
    twoTopHits: [twoTop],
    twoBottomHits: [twoBottomDigits],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: uniqueDigits(threeTop),
    runBottom: uniqueDigits(twoBottomDigits),
    resultPublishedAt: parsePublishedAt(normalizedRoundCode, drawTime),
    isSettlementSafe: true,
    sourceUrl,
    rawPayload: {
      lottosDate: roundCode,
      lottosTime: drawTime,
      lottosNumber: firstPrizeDigits,
      lottosUnder: twoBottomDigits
    }
  };
};

const extractSnapshotsFromHtml = (html, sourceUrl, limit = 10) => {
  const snapshots = [];
  const byRoundCode = new Map();
  let match;
  RESULT_ENTRY_PATTERN.lastIndex = 0;

  while ((match = RESULT_ENTRY_PATTERN.exec(html)) && snapshots.length < limit) {
    const snapshot = buildSnapshot({
      roundCode: match[1],
      drawTime: match[2],
      firstPrize: match[3],
      twoBottom: match[4],
      sourceUrl
    });

    if (snapshot && !byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, snapshot);
      snapshots.push(snapshot);
    }
  }

  return snapshots;
};

const extractSiamgloSnapshotsFromHtml = (html, sourceUrl, limit = 10) => {
  const snapshots = [];
  const byRoundCode = new Map();
  let match;
  SIAMGLO_RESULT_ROW_PATTERN.lastIndex = 0;

  while ((match = SIAMGLO_RESULT_ROW_PATTERN.exec(html)) && snapshots.length < limit) {
    const snapshot = buildSnapshot({
      roundCode: parseThaiRoundDate(match[1]),
      drawTime: SIAMGLO_DRAW_TIME,
      firstPrize: match[4] || match[2],
      twoBottom: match[3],
      sourceUrl
    });

    if (snapshot && !byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, snapshot);
      snapshots.push(snapshot);
    }
  }

  return snapshots;
};

const fetchSnapshotsFromUrl = async (url, limit) => {
  const response = await http.get(url);
  return extractSnapshotsFromHtml(stringValue(response.data), url, limit);
};

const fetchSiamgloSnapshotsFromUrl = async (url, limit) => {
  const response = await http.get(url);
  return extractSiamgloSnapshotsFromHtml(stringValue(response.data), url, limit);
};

const mergeSnapshots = (snapshotGroups, limit) => {
  const byRoundCode = new Map();

  snapshotGroups.flat().forEach((snapshot) => {
    if (snapshot && !byRoundCode.has(snapshot.roundCode)) {
      byRoundCode.set(snapshot.roundCode, snapshot);
    }
  });

  return [...byRoundCode.values()]
    .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
    .slice(0, limit);
};

const formatFetchError = (url, error) => {
  const status = error?.response?.status;
  const reason = status ? `HTTP ${status}` : error?.message || 'unknown error';
  return `${url} (${reason})`;
};

const fetchSnapshotsSafely = async (fetcher, url, limit) => {
  try {
    return {
      url,
      snapshots: await fetcher(url, limit),
      error: null
    };
  } catch (error) {
    return {
      url,
      snapshots: [],
      error
    };
  }
};

const fetchHanoiStarSnapshotsWithFetcher = async ({
  limit = 10,
  fetcher = fetchSnapshotsFromUrl,
  siamgloFetcher = fetchSiamgloSnapshotsFromUrl
} = {}) => {
  const normalizedLimit = Math.max(1, Number(limit) || 1);
  const primary = await fetchSnapshotsSafely(fetcher, HANOI_STAR_SITE_URL, normalizedLimit);

  if (primary.snapshots.length >= normalizedLimit) {
    return primary.snapshots
      .sort((left, right) => right.roundCode.localeCompare(left.roundCode))
      .slice(0, normalizedLimit);
  }

  const fallback = await fetchSnapshotsSafely(fetcher, HANOI_STAR_HISTORY_URL, normalizedLimit);
  const merged = mergeSnapshots([primary.snapshots, fallback.snapshots], normalizedLimit);

  if (merged.length) {
    return merged;
  }

  const siamglo = await fetchSnapshotsSafely(siamgloFetcher, HANOI_STAR_SIAMGLO_URL, normalizedLimit);
  if (siamglo.snapshots.length) {
    return mergeSnapshots([siamglo.snapshots], normalizedLimit);
  }

  const errors = [primary, fallback, siamglo]
    .filter((attempt) => attempt.error)
    .map((attempt) => formatFetchError(attempt.url, attempt.error));

  if (errors.length) {
    throw new Error(`Unable to fetch Hanoi Star snapshots: ${errors.join('; ')}`);
  }

  return [];
};

const fetchHanoiStarSnapshots = (options = {}) => fetchHanoiStarSnapshotsWithFetcher(options);

const fetchLatestHanoiStarSnapshot = async () => {
  const snapshots = await fetchHanoiStarSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  HANOI_STAR_PROVIDER_NAME,
  HANOI_STAR_MARKET_ID,
  HANOI_STAR_MARKET_NAME,
  HANOI_STAR_SITE_URL,
  HANOI_STAR_HISTORY_URL,
  HANOI_STAR_SIAMGLO_URL,
  fetchHanoiStarSnapshots,
  fetchLatestHanoiStarSnapshot,
  __test: {
    buildSnapshot,
    extractSnapshotsFromHtml,
    extractSiamgloSnapshotsFromHtml,
    fetchHanoiStarSnapshotsWithFetcher,
    parseThaiRoundDate,
    parseRoundCode
  }
};
