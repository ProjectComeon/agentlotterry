const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const BAAC_PROVIDER_NAME = 'BAAC Official';
const BAAC_MARKET_ID = 'baac';
const BAAC_LOTTERY_CODE = 'baac';
const BAAC_FEED_CODE = 'baac';
const BAAC_MARKET_NAME = 'สลากออมทรัพย์ ธกส.';
const BAAC_SITE_URL = 'https://www.baac.or.th/salak/';
const BAAC_RESULT_URL = `${BAAC_SITE_URL}content-lotto.php`;
const BAAC_TIMEOUT_MS = Number(process.env.BAAC_TIMEOUT_MS || 15000);

const http = axios.create({
  timeout: BAAC_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 Codex AdminAgentLotterry',
    Referer: BAAC_RESULT_URL
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
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return '';
};

const toPublishedAt = (roundCode) => {
  const match = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return createBangkokDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 15, 0);
};

const extractAvailableRoundCodes = (html) => {
  const codes = [...String(html || '').matchAll(/value=["'](\d{4}-\d{2}-\d{2})["']/g)]
    .map((match) => match[1])
    .filter(Boolean);
  return [...new Set(codes)].sort((left, right) => right.localeCompare(left));
};

const extractFirstPrize = (html) => {
  const matches = [...String(html || '').matchAll(/<tr[^>]*>\s*<th[^>]*>\s*<b>[\s\S]*?<\/b>\s*<\/th>\s*<\/tr>\s*<tr[^>]*>\s*<td[^>]*>\s*(\d{7})\s*<\/td>/gi)];
  return matches.length ? matches[0][1] : '';
};

const extractPdfUrl = (html) => {
  const relativePath = String(html || '').match(/(?:\.\.\/)?file-upload\/[^"' ]+\.pdf/gi)?.[0] || '';
  if (!relativePath) return '';
  return new URL(relativePath.replace(/^\.\.\//, ''), BAAC_SITE_URL).href;
};

const buildSnapshot = ({ roundCode, firstPrize, sourceUrl, rawPayload }) => {
  const normalizedRoundCode = parseRoundCode(roundCode);
  const normalizedFirstPrize = compactDigits(firstPrize);
  const threeTop = tailDigits(normalizedFirstPrize, 3);
  const twoTop = tailDigits(normalizedFirstPrize, 2);
  const twoBottom = middleDigits(normalizedFirstPrize, 2);

  if (!normalizedRoundCode || !normalizedFirstPrize || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: BAAC_LOTTERY_CODE,
    feedCode: BAAC_FEED_CODE,
    marketName: BAAC_MARKET_NAME,
    roundCode: normalizedRoundCode,
    headline: normalizedFirstPrize,
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
    resultPublishedAt: toPublishedAt(normalizedRoundCode),
    isSettlementSafe: true,
    sourceUrl: sourceUrl || BAAC_RESULT_URL,
    rawPayload
  };
};

const fetchBaacLandingHtml = async () => {
  const response = await http.get(BAAC_RESULT_URL);
  return String(response.data || '');
};

const fetchBaacRoundHtml = async (roundCode) => {
  const form = new URLSearchParams({
    lotto_date: roundCode,
    category: '',
    content_group: '3',
    inside: '4'
  });
  const response = await http.post(BAAC_RESULT_URL, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return String(response.data || '');
};

const fetchBaacAvailableRoundCodes = async () => {
  const html = await fetchBaacLandingHtml();
  return extractAvailableRoundCodes(html);
};

const fetchBaacSnapshotByRoundCode = async (roundCode) => {
  const normalizedRoundCode = parseRoundCode(roundCode);
  if (!normalizedRoundCode) {
    return null;
  }

  const html = await fetchBaacRoundHtml(normalizedRoundCode);
  return buildSnapshot({
    roundCode: normalizedRoundCode,
    firstPrize: extractFirstPrize(html),
    sourceUrl: extractPdfUrl(html),
    rawPayload: {
      roundCode: normalizedRoundCode,
      firstPrize: extractFirstPrize(html),
      sourceUrl: extractPdfUrl(html)
    }
  });
};

const fetchBaacSnapshots = async ({ limit = 10 } = {}) => {
  const roundCodes = await fetchBaacAvailableRoundCodes();
  const selectedCodes = roundCodes.slice(0, Math.max(1, Number(limit) || 1));
  const snapshots = await Promise.all(selectedCodes.map((roundCode) => fetchBaacSnapshotByRoundCode(roundCode).catch(() => null)));
  return snapshots.filter(Boolean);
};

const fetchLatestBaacSnapshot = async () => {
  const snapshots = await fetchBaacSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  BAAC_PROVIDER_NAME,
  BAAC_MARKET_ID,
  BAAC_LOTTERY_CODE,
  BAAC_FEED_CODE,
  BAAC_MARKET_NAME,
  BAAC_RESULT_URL,
  fetchBaacAvailableRoundCodes,
  fetchBaacSnapshotByRoundCode,
  fetchBaacSnapshots,
  fetchLatestBaacSnapshot
};
