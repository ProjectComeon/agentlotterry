const axios = require('axios');
const { createBangkokDate } = require('../utils/bangkokTime');

const GSB_PROVIDER_NAME = 'gsb';
const GSB_MARKET_ID = 'gsb';
const GSB_MARKET_NAME = 'ออมสิน';
const GSB_LIST_URL = 'https://www.gsb.or.th/personal/resultsalak/?type=salak-1year-100';
const GSB_DETAIL_URL_PATTERN = /^https:\/\/psc\.gsb\.or\.th\/resultsalak\/salak-1year-100\/(\d{8})\/?$/i;
const GSB_DATE_ID_PATTERN = /\/resultsalak\/salak-1year-100\/(\d{8})\/?/i;
const GSB_RESULT_LABELS = [
  'อันดับที่ 1',
  'อันดับที่ 2',
  'อันดับที่ 3',
  'อันดับที่ 4',
  'อันดับที่ 5',
  'เลขท้าย 4 ตัว',
  'เลขท้าย 3 ตัว'
];

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).join(' / ');
  return '';
};

const compactDigits = (value) => stringValue(value).replace(/\D/g, '');
const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};

const uniqueValues = (values) => [...new Set((values || []).filter(Boolean))];

const decodeHtmlEntities = (value) => stringValue(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const cleanHtmlText = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const parseGsbDateId = (value) => {
  const digits = String(value || '').match(/^\d{8}$/)?.[0];
  if (!digits) return '';
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
};

const sortGsbDetailUrls = (urls) => uniqueValues(urls).sort((left, right) => {
  const leftId = left.match(GSB_DATE_ID_PATTERN)?.[1] || '';
  const rightId = right.match(GSB_DATE_ID_PATTERN)?.[1] || '';
  return parseGsbDateId(rightId).localeCompare(parseGsbDateId(leftId));
});

const extractGsbSectionText = (text, label, nextLabel) => {
  const startIndex = text.indexOf(label);
  if (startIndex < 0) return '';
  const start = startIndex + label.length;
  const end = nextLabel ? text.indexOf(nextLabel, start) : -1;
  const sliced = end >= 0 ? text.slice(start, end) : text.slice(start);
  return stringValue(sliced.replace(/สั่งพิมพ์หน้านี้[\s\S]*$/i, ''));
};

const takeTextAfterLastBaht = (text) => {
  const normalized = stringValue(text);
  if (!normalized) return '';
  const parts = normalized.split('บาท');
  return stringValue(parts[parts.length - 1]);
};

const extractLastMatch = (text, pattern) => {
  const matches = [...stringValue(text).matchAll(pattern)];
  return matches.length ? matches[matches.length - 1][0] : '';
};

const toRunDigits = (...values) => [...new Set(values.join('').split('').filter(Boolean))];

const toPublishedAt = (roundCode) => {
  const match = String(roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return createBangkokDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0, 0);
};

const buildSnapshotFromDetail = ({ detailUrl, detailHtml }) => {
  const detailText = cleanHtmlText(detailHtml);
  const sectionMap = GSB_RESULT_LABELS.reduce((acc, label, index) => {
    acc[label] = extractGsbSectionText(detailText, label, GSB_RESULT_LABELS[index + 1] || '');
    return acc;
  }, {});

  const rank1 = extractLastMatch(sectionMap['อันดับที่ 1'], /งวดที่\s*\d+\s+[A-Z]\s+\d{7}/g)
    || takeTextAfterLastBaht(sectionMap['อันดับที่ 1']);
  const rank2 = extractLastMatch(sectionMap['อันดับที่ 2'], /งวดที่\s*\d+\s+[A-Z]\s+\d{7}/g)
    || takeTextAfterLastBaht(sectionMap['อันดับที่ 2']);
  const roundCode = parseGsbDateId(detailUrl.match(GSB_DATE_ID_PATTERN)?.[1] || '');
  const threeTop = tailDigits(rank1, 3);
  const twoTop = tailDigits(rank1, 2);
  const twoBottom = tailDigits(rank2, 2);

  if (!roundCode || !threeTop || !twoTop || !twoBottom) {
    return null;
  }

  return {
    lotteryCode: GSB_MARKET_ID,
    feedCode: GSB_MARKET_ID,
    marketName: GSB_MARKET_NAME,
    roundCode,
    headline: threeTop,
    firstPrize: '',
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
    runTop: toRunDigits(threeTop),
    runBottom: toRunDigits(twoBottom),
    resultPublishedAt: toPublishedAt(roundCode),
    isSettlementSafe: true,
    sourceUrl: detailUrl,
    rawPayload: {
      rank1,
      rank2,
      detailUrl
    }
  };
};

const fetchGsbDetailUrls = async ({ limit = 1 } = {}) => {
  const listResponse = await axios.get(GSB_LIST_URL, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 Codex AdminAgentLotterry'
    }
  });

  return sortGsbDetailUrls(
    [...String(listResponse.data || '').matchAll(/https:\/\/psc\.gsb\.or\.th\/resultsalak\/salak-1year-100\/\d{8}\/?/gi)]
      .map((match) => match[0])
      .filter((url) => GSB_DETAIL_URL_PATTERN.test(url))
  ).slice(0, Math.max(1, Number(limit) || 1));
};

const fetchGsbSnapshots = async ({ limit = 1 } = {}) => {
  const detailUrls = await fetchGsbDetailUrls({ limit });
  const detailPages = await Promise.all(detailUrls.map((detailUrl) =>
    axios.get(detailUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 Codex AdminAgentLotterry'
      }
    }).then((response) => ({ detailUrl, detailHtml: response.data }))
  ));

  return detailPages
    .map((page) => buildSnapshotFromDetail(page))
    .filter(Boolean);
};

const fetchLatestGsbSnapshot = async () => {
  const snapshots = await fetchGsbSnapshots({ limit: 1 });
  return snapshots[0] || null;
};

module.exports = {
  GSB_PROVIDER_NAME,
  GSB_MARKET_ID,
  GSB_MARKET_NAME,
  GSB_LIST_URL,
  fetchGsbSnapshots,
  fetchLatestGsbSnapshot
};
