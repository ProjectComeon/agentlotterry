const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');
const { MANYCAI_FEED_BASE_URL } = require('./externalResultFeedService');
const {
  GSB_MARKET_ID,
  GSB_MARKET_NAME,
  GSB_PROVIDER_NAME,
  fetchLatestGsbSnapshot
} = require('./gsbResultService');

const PROVIDER_NAME = 'manycai';
const RAW_PROVIDER_KEY = String(process.env.MANYCAI_API_KEY || '').trim();
const PROVIDER_KEY = RAW_PROVIDER_KEY || '__feed_fallback__';
const PROVIDER_BASE_URL = (
  RAW_PROVIDER_KEY
    ? `${(process.env.MANYCAI_BASE_URL || 'http://vip.manycai.com').replace(/\/$/, '')}/${RAW_PROVIDER_KEY}`
    : MANYCAI_FEED_BASE_URL
).replace(/\/$/, '');
const CACHE_TTL_MS = Number(process.env.MARKET_RESULTS_CACHE_MS || 60000);

const cache = {
  data: null,
  fetchedAt: 0
};

const MANYCAI_MARKETS = [
  { code: 'tgfc', marketId: 'thai-government', name: 'รัฐบาลไทย', sectionId: 'government', type: 'standard' },
  { code: 'baac', marketId: 'baac', name: 'สลากออมทรัพย์ ธกส.', sectionId: 'government', type: 'baac' },
  { code: 'hnvip', marketId: 'hanoi-vip', name: 'ฮานอย VIP', sectionId: 'international', type: 'standard' },
  { code: 'bfhn', marketId: 'hanoi-special', name: 'ฮานอยพิเศษ', sectionId: 'international', type: 'standard' },
  { code: 'cqhn', marketId: 'hanoi-specific', name: 'ฮานอยเฉพาะกิจ', sectionId: 'international', type: 'standard' },
  { code: 'tlzc', marketId: 'lao', name: 'หวยลาว', sectionId: 'international', type: 'standard' },
  { code: 'zcvip', marketId: 'lao-vip', name: 'หวยลาว VIP', sectionId: 'international', type: 'standard' },
  { code: 'ynhn', marketId: 'hanoi-normal', name: 'ฮานอยธรรมดา', sectionId: 'international', type: 'standard' },
  { code: 'ynma', marketId: 'malay', name: 'มาเลย์', sectionId: 'international', type: 'standard' },
  { code: 'tykc', marketId: 'yeekee-vip', name: 'จับยี่กี VIP', sectionId: 'international', type: 'standard' },
  { code: 'gsth', marketId: 'stock-thai', name: 'หุ้นไทย', sectionId: 'stocks', type: 'stock' },
  { code: 'gshka', marketId: 'stock-hangseng-morning', name: 'ฮั่งเส็งเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gshkp', marketId: 'stock-hangseng-afternoon', name: 'ฮั่งเส็งบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gstw', marketId: 'stock-taiwan', name: 'หุ้นไต้หวัน', sectionId: 'stocks', type: 'stock' },
  { code: 'gsjpa', marketId: 'stock-nikkei-morning', name: 'นิเคอิเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gsjpp', marketId: 'stock-nikkei-afternoon', name: 'นิเคอิบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gskr', marketId: 'stock-korea', name: 'หุ้นเกาหลี', sectionId: 'stocks', type: 'stock' },
  { code: 'gscna', marketId: 'stock-china-morning', name: 'หุ้นจีนเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gscnp', marketId: 'stock-china-afternoon', name: 'หุ้นจีนบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gssg', marketId: 'stock-singapore', name: 'หุ้นสิงคโปร์', sectionId: 'stocks', type: 'stock' },
  { code: 'gsin', marketId: 'stock-india', name: 'หุ้นอินเดีย', sectionId: 'stocks', type: 'stock' },
  { code: 'gseg', marketId: 'stock-egypt', name: 'หุ้นอียิปต์', sectionId: 'stocks', type: 'stock' },
  { code: 'gsru', marketId: 'stock-russia', name: 'หุ้นรัสเซีย', sectionId: 'stocks', type: 'stock' },
  { code: 'gsde', marketId: 'stock-germany', name: 'หุ้นเยอรมัน', sectionId: 'stocks', type: 'stock' },
  { code: 'gsuk', marketId: 'stock-england', name: 'หุ้นอังกฤษ', sectionId: 'stocks', type: 'stock' },
  { code: 'gsus', marketId: 'stock-dowjones', name: 'หุ้นดาวโจนส์', sectionId: 'stocks', type: 'stock' }
];

const baseSections = [
  {
    id: 'government',
    title: 'รัฐบาล',
    description: 'หวยรัฐบาลและสลากออมทรัพย์',
    markets: [
      { id: 'thai-government', name: 'รัฐบาลไทย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'baac', name: 'สลากออมทรัพย์ ธกส.', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: GSB_MARKET_ID, name: GSB_MARKET_NAME, provider: GSB_PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากเว็บไซต์ GSB' }
    ]
  },
  {
    id: 'international',
    title: 'หวยต่างประเทศ',
    description: 'ข้อมูลจาก ManyCai',
    markets: [
      { id: 'hanoi-vip', name: 'ฮานอย VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-special', name: 'ฮานอยพิเศษ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-specific', name: 'ฮานอยเฉพาะกิจ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'lao', name: 'หวยลาว', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'lao-vip', name: 'หวยลาว VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-normal', name: 'ฮานอยธรรมดา', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'malay', name: 'มาเลย์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'yeekee-vip', name: 'จับยี่กี VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' }
    ]
  },
  {
    id: 'stocks',
    title: 'หุ้น',
    description: 'ข้อมูลหุ้นจาก ManyCai',
    markets: [
      { id: 'stock-thai', name: 'หุ้นไทย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-hangseng-morning', name: 'ฮั่งเส็งเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-hangseng-afternoon', name: 'ฮั่งเส็งบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-taiwan', name: 'หุ้นไต้หวัน', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-nikkei-morning', name: 'นิเคอิเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-nikkei-afternoon', name: 'นิเคอิบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-korea', name: 'หุ้นเกาหลี', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-china-morning', name: 'หุ้นจีนเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-china-afternoon', name: 'หุ้นจีนบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-singapore', name: 'หุ้นสิงคโปร์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-india', name: 'หุ้นอินเดีย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-egypt', name: 'หุ้นอียิปต์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-russia', name: 'หุ้นรัสเซีย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-germany', name: 'หุ้นเยอรมัน', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-england', name: 'หุ้นอังกฤษ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-dowjones', name: 'หุ้นดาวโจนส์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' }
    ]
  }
];

const cloneSections = () => baseSections.map((section) => ({
  ...section,
  markets: section.markets.map((market) => ({
    ...market,
    numbers: [...market.numbers]
  }))
}));

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).join(' / ');
  return '';
};

const isMasked = (value) => /x/i.test(stringValue(value));
const hasValue = (value) => {
  const normalized = stringValue(value);
  return normalized && !isMasked(normalized);
};

const setMarketData = (sections, sectionId, nextMarket) => {
  const section = sections.find((entry) => entry.id === sectionId);
  if (!section) return;

  const marketIndex = section.markets.findIndex((market) => market.id === nextMarket.id);

  if (marketIndex >= 0) {
    section.markets[marketIndex] = {
      ...section.markets[marketIndex],
      ...nextMarket,
      numbers: nextMarket.numbers || section.markets[marketIndex].numbers || []
    };
    return;
  }

  section.markets.push(nextMarket);
};

const compactDigits = (value) => stringValue(value).replace(/[^0-9xX]/g, '');
const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};
const twoDigitScalar = (value) => {
  const digits = compactDigits(value);
  return digits.length === 2 ? digits : '';
};
const middleDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  if (digits.length <= length) return digits;
  const start = Math.floor((digits.length - length) / 2);
  return digits.slice(start, start + length);
};
const mergeUniqueValues = (...values) => [...new Set(values.flat().filter(Boolean))];

const formatIssueDate = (issue, openDate) => {
  const normalizedIssue = stringValue(issue).replace(/\D/g, '');
  if (normalizedIssue.length === 8) {
    return `${normalizedIssue.slice(0, 4)}-${normalizedIssue.slice(4, 6)}-${normalizedIssue.slice(6, 8)}`;
  }

  const normalizedOpenDate = stringValue(openDate);
  return normalizedOpenDate ? normalizedOpenDate.slice(0, 10) : '';
};

const fetchProvider = async (code) => {
  const response = await axios.get(`${PROVIDER_BASE_URL}/${code}.json`, {
    timeout: 12000
  });

  return response.data;
};

const fetchGsbLatestMarket = async () => {
  const snapshot = await fetchLatestGsbSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: GSB_MARKET_ID,
    name: GSB_MARKET_NAME,
    provider: GSB_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.headline,
    numbers: [
      { label: '3 ตัวบน', value: snapshot.threeTop },
      { label: '2 ตัวบน', value: snapshot.twoTop },
      { label: '2 ตัวล่าง', value: snapshot.twoBottom }
    ],
    note: 'ตรวจจับจากเว็บไซต์ GSB และแปลงผลแบบเดียวกับ GOGOLot',
    sourceUrl: snapshot.sourceUrl
  });
};

const extractManyCaiRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getLatestManyCaiRow = (payload) => extractManyCaiRows(payload)[0] || null;

const marketStatus = (headline, numbers) => {
  const values = [headline, ...(numbers || []).map((item) => item.value)].filter(Boolean);
  if (values.some((value) => hasValue(value))) return 'live';
  if (values.some((value) => isMasked(value))) return 'pending';
  return 'waiting';
};

const buildNumbers = (pairs) => pairs
  .filter((pair) => pair && stringValue(pair.value))
  .map((pair) => ({ label: pair.label, value: stringValue(pair.value) }));

const buildMarket = ({ id, name, provider, resultDate, headline, numbers, note, sourceUrl }) => ({
  id,
  name,
  provider,
  resultDate: stringValue(resultDate),
  headline: stringValue(headline),
  numbers: buildNumbers(numbers),
  note: stringValue(note),
  sourceUrl: stringValue(sourceUrl),
  status: marketStatus(headline, numbers)
});

const applyGovernmentFromLocal = async (sections) => {
  const latest = await LotteryResult.findOne().sort({ roundDate: -1 });
  if (!latest) return false;

  setMarketData(sections, 'government', buildMarket({
    id: 'thai-government',
    name: 'รัฐบาลไทย',
    provider: 'internal',
    resultDate: latest.roundDate,
    headline: latest.firstPrize,
    numbers: [
      { label: '3 ตัวบน', value: tailDigits(latest.firstPrize, 3) },
      { label: '2 ตัวบน', value: tailDigits(latest.firstPrize, 2) },
      { label: '3 ตัวหน้า', value: mergeUniqueValues(latest.threeTopList || []).join(' / ') },
      { label: '3 ตัวล่าง', value: mergeUniqueValues(latest.threeBotList || []).join(' / ') },
      { label: '2 ตัวล่าง', value: latest.twoBottom || '' }
    ],
    note: latest.isCalculated ? 'ผลในระบบคำนวณแล้ว' : 'ผลในระบบพร้อมใช้งาน'
  }));

  return true;
};

const applyManyCaiStandardMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const firstPrize = compactDigits(row?.code?.code);
  const fourDigits = compactDigits(row?.code?.code_last4);
  const threeDigits = compactDigits(row?.code?.code_last3) || tailDigits(firstPrize, 3);
  const twoTopDigits = compactDigits(row?.code?.code_last2) || tailDigits(firstPrize, 2);
  const twoBottomDigits =
    tailDigits(row?.code?.code1, 2) ||
    twoDigitScalar(row?.code?.code2) ||
    compactDigits(row?.code?.code_pre2) ||
    compactDigits(row?.code?.code_mid2);

  if (!firstPrize && !threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: firstPrize || threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '4 ตัวบน', value: fourDigits },
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyManyCaiStockMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const threeDigits = compactDigits(row?.code?.code);
  const twoTopDigits = tailDigits(threeDigits, 2);
  const twoBottomDigits = compactDigits(row?.code?.code1);

  if (!threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyManyCaiBaacMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const firstPrize = compactDigits(row?.code?.code);
  const threeDigits = tailDigits(firstPrize, 3);
  const twoTopDigits = tailDigits(firstPrize, 2);
  const twoBottomDigits = middleDigits(firstPrize, 2);

  if (!firstPrize && !threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: firstPrize || threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyGsbMarket = async (sections) => {
  const market = await fetchGsbLatestMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'government', market);
  return true;
};

const buildSummary = (sections) => {
  const markets = sections.flatMap((section) => section.markets);
  const liveCount = markets.filter((market) => market.status === 'live').length;
  const pendingCount = markets.filter((market) => market.status === 'pending').length;
  const unsupportedCount = markets.filter((market) => market.status === 'unsupported').length;

  return {
    totalMarkets: markets.length,
    liveCount,
    pendingCount,
    unsupportedCount
  };
};

const getMarketOverview = async () => {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const sections = cloneSections();
  const warnings = [];
  const hasGovernmentData = await applyGovernmentFromLocal(sections);

  if (!hasGovernmentData) {
    warnings.push('ยังไม่มีผลหวยรัฐบาลไทยในระบบฐานข้อมูล');
  }

  try {
    const hasGsbData = await applyGsbMarket(sections);
    if (!hasGsbData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูลออมสินจากเว็บไซต์ GSB ได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูลออมสินจากเว็บไซต์ GSB ได้');
  }

  if (!PROVIDER_KEY) {
    warnings.push('ยังไม่ได้ตั้งค่า MANYCAI_API_KEY บน backend ตลาดที่ใช้ ManyCai จะแสดงเป็นรอเชื่อมต่อ');

    warnings.push('Using ManyCai feed fallback because MANYCAI_API_KEY is not configured');
  }

  const requests = await Promise.allSettled(MANYCAI_MARKETS.map((market) => fetchProvider(market.code)));

  requests.forEach((result, index) => {
    const market = MANYCAI_MARKETS[index];
    if (!market) {
      return;
    }

    if (result.status !== 'fulfilled') {
      warnings.push(`ไม่สามารถดึงข้อมูล ${market.name} จาก ManyCai ได้`);
      return;
    }

    const hydrated = market.type === 'stock'
      ? applyManyCaiStockMarket(sections, market, result.value)
      : market.type === 'baac'
        ? applyManyCaiBaacMarket(sections, market, result.value)
      : applyManyCaiStandardMarket(sections, market, result.value);

    if (!hydrated) {
      warnings.push(`ไม่สามารถแปลงข้อมูล ${market.name} จาก ManyCai ได้`);
    }
  });

  const overview = {
    provider: {
      name: PROVIDER_NAME,
      configured: true,
      baseUrl: PROVIDER_BASE_URL,
      fetchedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS
    },
    summary: buildSummary(sections),
    warnings,
    sections
  };

  cache.data = overview;
  cache.fetchedAt = Date.now();

  return overview;
};

const getMarketById = async (marketId) => {
  const overview = await getMarketOverview();

  for (const section of overview.sections || []) {
    const market = (section.markets || []).find((entry) => entry.id === marketId);
    if (market) {
      return {
        ...market,
        sectionId: section.id,
        sectionTitle: section.title,
        providerConfigured: market.provider !== PROVIDER_NAME || overview.provider?.configured
      };
    }
  }

  return null;
};

module.exports = { getMarketOverview, getMarketById };
