const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const MarketFeedResult = require('../models/MarketFeedResult');
const { createBangkokDate } = require('../utils/bangkokTime');
const { ensureRoundForLottery, settleRoundById, upsertRoundResult } = require('./resultService');
const { fetchGsbSnapshots } = require('./gsbResultService');
const {
  fetchLatestThaiGovernmentSnapshot,
  fetchThaiGovernmentSnapshotByRoundCode,
  fetchThaiGovernmentSnapshots
} = require('./thaiGovernmentResultService');
const { fetchBaacSnapshots } = require('./baacResultService');
const { fetchLaosSnapshots } = require('./laosResultService');
const { fetchLaosVipSnapshots } = require('./laosVipResultService');
const { fetchLaosRedcrossSnapshots } = require('./laosRedcrossResultService');
const { fetchLaosPathanaSnapshots } = require('./laosPathanaResultService');
const { fetchLaosTvSnapshots } = require('./laosTvResultService');
const { fetchLaosHdSnapshots } = require('./laosHdResultService');
const { fetchLaosExtraSnapshots } = require('./laosExtraResultService');
const { fetchLaosStarsSnapshots } = require('./laosStarsResultService');
const { fetchLaosStarsVipSnapshots } = require('./laosStarsVipResultService');
const { fetchLaosUnionSnapshots } = require('./laosUnionResultService');
const { fetchLaosUnionVipSnapshots } = require('./laosUnionVipResultService');
const { fetchLaosAseanSnapshots } = require('./laosAseanResultService');
const { fetchHanoiExtraSnapshots } = require('./hanoiExtraResultService');
const { fetchHanoiStarSnapshots } = require('./hanoiStarResultService');
const { fetchHanoiDevelopSnapshots } = require('./hanoiDevelopResultService');
const { fetchHanoiHdSnapshots } = require('./hanoiHdResultService');
const { fetchHanoiTvSnapshots } = require('./hanoiTvResultService');
const { fetchHanoiRedcrossSnapshots } = require('./hanoiRedcrossResultService');
const { fetchHanoiUnionSnapshots } = require('./hanoiUnionResultService');
const { fetchHanoiAseanSnapshots } = require('./hanoiAseanResultService');
const {
  fetchShenzhenMorningVipSnapshots,
  fetchShenzhenAfternoonVipSnapshots
} = require('./shenzhenIndexVipResultService');
const {
  fetchNikkeiMorningVipSnapshots,
  fetchNikkeiAfternoonVipSnapshots
} = require('./nikkeiVipResultService');
const {
  fetchEnglandVipSnapshots,
  fetchGermanyVipSnapshots,
  fetchRussiaVipSnapshots
} = require('./lottoSuperRichVipResultService');
const { fetchKoreaVipSnapshots } = require('./koreaVipResultService');
const { fetchTaiwanVipSnapshots } = require('./taiwanVipResultService');
const { fetchSingaporeVipSnapshots } = require('./singaporeVipResultService');
const { fetchDowjonesVipSnapshots } = require('./dowjonesVipResultService');
const {
  fetchHsiMorningVipSnapshots,
  fetchHsiAfternoonVipSnapshots
} = require('./hsiVipResultService');

const legacyBaseUrl = (process.env.MANYCAI_BASE_URL || 'http://vip.manycai.com').replace(/\/$/, '');
const legacyApiKey = String(process.env.MANYCAI_API_KEY || '').trim();
const MANYCAI_FEED_BASE_URL = (
  process.env.MANYCAI_FEED_BASE_URL ||
  (legacyApiKey ? `${legacyBaseUrl}/${legacyApiKey}` : 'http://vip.manycai.com/K269c291856f58e')
).replace(/\/$/, '');
const RESULT_SYNC_TIMEOUT_MS = Number(process.env.RESULT_SYNC_TIMEOUT_MS || 12000);
const RESULT_SYNC_BATCH_SIZE = Math.max(1, Number(process.env.RESULT_SYNC_BATCH_SIZE || 6));
const RESULT_SYNC_STARTUP_DELAY_MS = Math.max(0, Number(process.env.RESULT_SYNC_STARTUP_DELAY_MS || 60000));
const STRICT_FEED_MAPPING = String(process.env.STRICT_FEED_MAPPING || '1') !== '0';
const GSB_SYNC_LIMIT = Number(process.env.GSB_SYNC_LIMIT || 6);
const THAI_GOV_SYNC_LIMIT = Number(process.env.THAI_GOV_SYNC_LIMIT || 10);
const BAAC_SYNC_LIMIT = Number(process.env.BAAC_SYNC_LIMIT || 10);
const LAOS_SYNC_LIMIT = Number(process.env.LAOS_SYNC_LIMIT || 10);
const LAOS_VIP_SYNC_LIMIT = Number(process.env.LAOS_VIP_SYNC_LIMIT || 10);
const LAOS_REDCROSS_SYNC_LIMIT = Number(process.env.LAOS_REDCROSS_SYNC_LIMIT || 10);
const LAOS_PATHANA_SYNC_LIMIT = Number(process.env.LAOS_PATHANA_SYNC_LIMIT || 10);
const LAOS_TV_SYNC_LIMIT = Number(process.env.LAOS_TV_SYNC_LIMIT || 10);
const LAOS_HD_SYNC_LIMIT = Number(process.env.LAOS_HD_SYNC_LIMIT || 10);
const LAOS_EXTRA_SYNC_LIMIT = Number(process.env.LAOS_EXTRA_SYNC_LIMIT || 10);
const LAOS_STAR_SYNC_LIMIT = Number(process.env.LAOS_STAR_SYNC_LIMIT || 10);
const LAOS_STAR_VIP_SYNC_LIMIT = Number(process.env.LAOS_STAR_VIP_SYNC_LIMIT || 10);
const LAOS_UNION_SYNC_LIMIT = Number(process.env.LAOS_UNION_SYNC_LIMIT || 10);
const LAOS_UNION_VIP_SYNC_LIMIT = Number(process.env.LAOS_UNION_VIP_SYNC_LIMIT || 10);
const LAOS_ASEAN_SYNC_LIMIT = Number(process.env.LAOS_ASEAN_SYNC_LIMIT || 10);
const HANOI_EXTRA_SYNC_LIMIT = Number(process.env.HANOI_EXTRA_SYNC_LIMIT || 10);
const HANOI_STAR_SYNC_LIMIT = Number(process.env.HANOI_STAR_SYNC_LIMIT || 10);
const HANOI_DEVELOP_SYNC_LIMIT = Number(process.env.HANOI_DEVELOP_SYNC_LIMIT || 10);
const HANOI_HD_SYNC_LIMIT = Number(process.env.HANOI_HD_SYNC_LIMIT || 10);
const HANOI_TV_SYNC_LIMIT = Number(process.env.HANOI_TV_SYNC_LIMIT || 10);
const HANOI_REDCROSS_SYNC_LIMIT = Number(process.env.HANOI_REDCROSS_SYNC_LIMIT || 10);
const HANOI_UNION_SYNC_LIMIT = Number(process.env.HANOI_UNION_SYNC_LIMIT || 10);
const HANOI_ASEAN_SYNC_LIMIT = Number(process.env.HANOI_ASEAN_SYNC_LIMIT || 10);
const SHENZHEN_MORNING_VIP_SYNC_LIMIT = Number(process.env.SHENZHEN_MORNING_VIP_SYNC_LIMIT || 10);
const SHENZHEN_AFTERNOON_VIP_SYNC_LIMIT = Number(process.env.SHENZHEN_AFTERNOON_VIP_SYNC_LIMIT || 10);
const NIKKEI_MORNING_VIP_SYNC_LIMIT = Number(process.env.NIKKEI_MORNING_VIP_SYNC_LIMIT || 10);
const NIKKEI_AFTERNOON_VIP_SYNC_LIMIT = Number(process.env.NIKKEI_AFTERNOON_VIP_SYNC_LIMIT || 10);
const ENGLAND_VIP_SYNC_LIMIT = Number(process.env.ENGLAND_VIP_SYNC_LIMIT || 10);
const GERMANY_VIP_SYNC_LIMIT = Number(process.env.GERMANY_VIP_SYNC_LIMIT || 10);
const RUSSIA_VIP_SYNC_LIMIT = Number(process.env.RUSSIA_VIP_SYNC_LIMIT || 10);
const KOREA_VIP_SYNC_LIMIT = Number(process.env.KOREA_VIP_SYNC_LIMIT || 10);
const TAIWAN_VIP_SYNC_LIMIT = Number(process.env.TAIWAN_VIP_SYNC_LIMIT || 10);
const SINGAPORE_VIP_SYNC_LIMIT = Number(process.env.SINGAPORE_VIP_SYNC_LIMIT || 10);
const DOWJONES_VIP_SYNC_LIMIT = Number(process.env.DOWJONES_VIP_SYNC_LIMIT || 10);
const HSI_MORNING_VIP_SYNC_LIMIT = Number(process.env.HSI_MORNING_VIP_SYNC_LIMIT || 10);
const HSI_AFTERNOON_VIP_SYNC_LIMIT = Number(process.env.HSI_AFTERNOON_VIP_SYNC_LIMIT || 10);

const ROUND_CODE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const defaultMappedDigits = (value) => String(value || '').replace(/\D/g, '');
const defaultMappedList = (value) => {
  const flatten = (input) => Array.isArray(input) ? input.flatMap(flatten) : [input];
  return [...new Set(flatten(value).map(defaultMappedDigits).filter(Boolean))];
};

const scalarField = (path, transform = defaultMappedDigits) => ({ path, transform });
const listField = (path, transform = defaultMappedList) => ({ path, transform, isList: true });

const governmentFeedMapping = () => ({
  kind: 'government',
  firstPrize: scalarField('code.code'),
  threeFrontHits: listField('code.code1'),
  threeBottomHits: listField('code.code2'),
  twoBottom: scalarField('code.code3')
});

const stockFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code'),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code1')
});

const hanoiFiveDigitFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code', (value) => tailDigits(value, 3)),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code1', (value) => tailDigits(value, 2))
});

const fourDigitPre2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code_last2'),
  twoBottom: scalarField('code.code_pre2')
});

const fiveDigitCode2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code_last2'),
  twoBottom: scalarField('code.code2')
});

const yikiMid2FeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code_last3'),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code_mid2')
});

const baacFeedMapping = () => ({
  kind: 'generic',
  firstPrize: scalarField('code.code'),
  threeTop: scalarField('code.code', (value) => tailDigits(value, 3)),
  twoTop: scalarField('code.code', (value) => tailDigits(value, 2)),
  twoBottom: scalarField('code.code', (value) => middleDigits(value, 2))
});

const EXPLICIT_FEED_MAPPINGS = {
  hnvip: hanoiFiveDigitFeedMapping(),
  tlzc: fourDigitPre2FeedMapping(),
  tykc: yikiMid2FeedMapping(),
  tgfc: governmentFeedMapping(),
  baac: baacFeedMapping(),
  gshka: stockFeedMapping(),
  gshkp: stockFeedMapping(),
  bfhn: hanoiFiveDigitFeedMapping(),
  gstw: stockFeedMapping(),
  gsjpa: stockFeedMapping(),
  gsjpp: stockFeedMapping(),
  gskr: stockFeedMapping(),
  gscna: stockFeedMapping(),
  gscnp: stockFeedMapping(),
  gssg: stockFeedMapping(),
  gsth: stockFeedMapping(),
  gsin: stockFeedMapping(),
  gseg: stockFeedMapping(),
  gsru: stockFeedMapping(),
  gsde: stockFeedMapping(),
  gsuk: stockFeedMapping(),
  gsus: stockFeedMapping(),
  cqhn: hanoiFiveDigitFeedMapping(),
  zcvip: fiveDigitCode2FeedMapping(),
  ynhn: fourDigitPre2FeedMapping(),
  ynma: fourDigitPre2FeedMapping(),
  hanoi_union: hanoiFiveDigitFeedMapping(),
  hanoi_asean: hanoiFiveDigitFeedMapping()
};

const FEED_CONFIGS = [
  { feedCode: 'hnvip', lotteryCode: 'hnvip', marketName: 'ฮานอย VIP', parser: 'simple', syncToResults: true },
  { feedCode: 'tlzc', lotteryCode: 'tlzc', marketName: 'หวยลาว', parser: 'simple', syncToResults: true },
  { feedCode: 'tykc', lotteryCode: 'tykc', marketName: 'ยี่กี VIP', parser: 'simple', syncToResults: true, releaseByPublishedAt: true },
  { feedCode: 'tgfc', lotteryCode: 'thai_government', marketName: 'รัฐบาลไทย', parser: 'government', syncToResults: true, provider: 'thaiglo' },
  { feedCode: 'baac', lotteryCode: 'baac', marketName: 'ธ.ก.ส.', parser: 'baac', syncToResults: true, provider: 'baacofficial' },
  { feedCode: 'gshka', lotteryCode: 'gshka', marketName: 'หุ้นฮั่งเส็ง เช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gshkp', lotteryCode: 'gshkp', marketName: 'หุ้นฮั่งเส็ง บ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'bfhn', lotteryCode: 'hanoi_special', marketName: 'ฮานอยพิเศษ', parser: 'simple', syncToResults: true },
  { feedCode: 'gstw', lotteryCode: 'gstw', marketName: 'หุ้นไต้หวัน', parser: 'stock', syncToResults: true },
  { feedCode: 'gsjpa', lotteryCode: 'nikkei_morning', marketName: 'นิเคอิเช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gsjpp', lotteryCode: 'gsjpp', marketName: 'นิเคอิบ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'gskr', lotteryCode: 'gskr', marketName: 'หุ้นเกาหลี', parser: 'stock', syncToResults: true },
  { feedCode: 'gscna', lotteryCode: 'gscna', marketName: 'หุ้นจีนเช้า', parser: 'stock', syncToResults: true },
  { feedCode: 'gscnp', lotteryCode: 'china_afternoon', marketName: 'หุ้นจีนบ่าย', parser: 'stock', syncToResults: true },
  { feedCode: 'gssg', lotteryCode: 'gssg', marketName: 'หุ้นสิงคโปร์', parser: 'stock', syncToResults: true },
  { feedCode: 'gsth', lotteryCode: 'gsth', marketName: 'หุ้นไทย', parser: 'stock', syncToResults: true },
  { feedCode: 'gsin', lotteryCode: 'gsin', marketName: 'หุ้นอินเดีย', parser: 'stock', syncToResults: true },
  { feedCode: 'gseg', lotteryCode: 'gseg', marketName: 'หุ้นอียิปต์', parser: 'stock', syncToResults: true },
  { feedCode: 'gsru', lotteryCode: 'gsru', marketName: 'หุ้นรัสเซีย', parser: 'stock', syncToResults: true },
  { feedCode: 'gsde', lotteryCode: 'gsde', marketName: 'หุ้นเยอรมัน', parser: 'stock', syncToResults: true },
  { feedCode: 'gsuk', lotteryCode: 'gsuk', marketName: 'หุ้นอังกฤษ', parser: 'stock', syncToResults: true },
  { feedCode: 'gsus', lotteryCode: 'dowjones_vip', marketName: 'หุ้นดาวโจนส์', parser: 'stock', syncToResults: true },
  { feedCode: 'cqhn', lotteryCode: 'cqhn', marketName: 'ฮานอยเฉพาะกิจ', parser: 'simple', syncToResults: true },
  { feedCode: 'zcvip', lotteryCode: 'lao_vip', marketName: 'ลาว VIP', parser: 'simple', syncToResults: true },
  { feedCode: 'ynhn', lotteryCode: 'ynhn', marketName: 'ฮานอยธรรมดา', parser: 'simple', syncToResults: true },
  { feedCode: 'ynma', lotteryCode: 'ynma', marketName: 'มาเลย์', parser: 'simple', syncToResults: true }
];

const EXTRA_SYNC_CONFIGS = [
  { feedCode: 'gsb', lotteryCode: 'gsb', marketName: 'ออมสิน', parser: 'gsb', syncToResults: true, provider: 'gsb' }
];

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_redcross',
  lotteryCode: 'lao_redcross',
  marketName: '\u0e25\u0e32\u0e27\u0e01\u0e32\u0e0a\u0e32\u0e14',
  parser: 'laosredcross',
  syncToResults: true,
  provider: 'laosredcross'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_pathana',
  lotteryCode: 'lao_pathana',
  marketName: '\u0e25\u0e32\u0e27\u0e1e\u0e31\u0e12\u0e19\u0e32',
  parser: 'laospathana',
  syncToResults: true,
  provider: 'laospathana'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_tv',
  lotteryCode: 'lao_tv',
  marketName: '\u0e25\u0e32\u0e27 TV',
  parser: 'laostv',
  syncToResults: true,
  provider: 'laostv'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_hd',
  lotteryCode: 'lao_hd',
  marketName: '\u0e25\u0e32\u0e27 HD',
  parser: 'laoshd',
  syncToResults: true,
  provider: 'laoshd'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_extra',
  lotteryCode: 'lao_extra',
  marketName: '\u0e25\u0e32\u0e27 Extra',
  parser: 'laoextra',
  syncToResults: true,
  provider: 'laoextra'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_star',
  lotteryCode: 'lao_star',
  marketName: '\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c',
  parser: 'laostars',
  syncToResults: true,
  provider: 'laostars'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_star_vip',
  lotteryCode: 'lao_star_vip',
  marketName: '\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c VIP',
  parser: 'laostarsvip',
  syncToResults: true,
  provider: 'laostarsvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_union',
  lotteryCode: 'lao_union',
  marketName: '\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35',
  parser: 'laosunion',
  syncToResults: true,
  provider: 'laosunion'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_union_vip',
  lotteryCode: 'lao_union_vip',
  marketName: '\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 VIP',
  parser: 'laosunionvip',
  syncToResults: true,
  provider: 'laosunionvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'lao_asean',
  lotteryCode: 'lao_asean',
  marketName: '\u0e25\u0e32\u0e27\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19',
  parser: 'laosasean',
  syncToResults: true,
  provider: 'laosasean'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_extra',
  lotteryCode: 'hanoi_extra',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22 Extra',
  parser: 'hanoiextra',
  syncToResults: true,
  provider: 'hanoiextra'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_star',
  lotteryCode: 'hanoi_star',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e15\u0e32\u0e23\u0e4c',
  parser: 'hanoistar',
  syncToResults: true,
  provider: 'hanoistar'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_develop',
  lotteryCode: 'hanoi_develop',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e1e\u0e31\u0e12\u0e19\u0e32',
  parser: 'hanoidevelop',
  syncToResults: true,
  provider: 'hanoidevelop'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_hd',
  lotteryCode: 'hanoi_hd',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22 HD',
  parser: 'hanoihd',
  syncToResults: true,
  provider: 'hanoihd'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_tv',
  lotteryCode: 'hanoi_tv',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22 TV',
  parser: 'hanoitv',
  syncToResults: true,
  provider: 'hanoitv'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_redcross',
  lotteryCode: 'hanoi_redcross',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e01\u0e32\u0e0a\u0e32\u0e14',
  parser: 'hanoiredcross',
  syncToResults: true,
  provider: 'hanoiredcross'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_union',
  lotteryCode: 'hanoi_union',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35',
  parser: 'hanoiunion',
  syncToResults: true,
  provider: 'hanoiunion'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hanoi_asean',
  lotteryCode: 'hanoi_asean',
  marketName: '\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19',
  parser: 'hanoiasean',
  syncToResults: true,
  provider: 'hanoiasean'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'china_morning_vip',
  lotteryCode: 'china_morning_vip',
  marketName: '\u0e08\u0e35\u0e19\u0e40\u0e0a\u0e49\u0e32 VIP',
  parser: 'shenzhenmorningvip',
  syncToResults: true,
  provider: 'shenzhenmorningvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'china_afternoon_vip',
  lotteryCode: 'china_afternoon_vip',
  marketName: '\u0e08\u0e35\u0e19\u0e1a\u0e48\u0e32\u0e22 VIP',
  parser: 'shenzhenafternoonvip',
  syncToResults: true,
  provider: 'shenzhenafternoonvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'nikkei_morning_vip',
  lotteryCode: 'nikkei_morning_vip',
  marketName: '\u0e19\u0e34\u0e40\u0e04\u0e2d\u0e34\u0e40\u0e0a\u0e49\u0e32 VIP',
  parser: 'nikkeimorningvip',
  syncToResults: true,
  provider: 'nikkeimorningvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'nikkei_afternoon_vip',
  lotteryCode: 'nikkei_afternoon_vip',
  marketName: '\u0e19\u0e34\u0e40\u0e04\u0e2d\u0e34\u0e1a\u0e48\u0e32\u0e22 VIP',
  parser: 'nikkeiafternoonvip',
  syncToResults: true,
  provider: 'nikkeiafternoonvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hangseng_morning_vip',
  lotteryCode: 'hangseng_morning_vip',
  marketName: '\u0e2e\u0e31\u0e48\u0e07\u0e40\u0e2a\u0e47\u0e07\u0e40\u0e0a\u0e49\u0e32 VIP',
  parser: 'hsimorningvip',
  syncToResults: true,
  provider: 'hsimorningvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'hangseng_afternoon_vip',
  lotteryCode: 'hangseng_afternoon_vip',
  marketName: '\u0e2e\u0e31\u0e48\u0e07\u0e40\u0e2a\u0e47\u0e07\u0e1a\u0e48\u0e32\u0e22 VIP',
  parser: 'hsiafternoonvip',
  syncToResults: true,
  provider: 'hsiafternoonvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'england_vip',
  lotteryCode: 'england_vip',
  marketName: '\u0e2d\u0e31\u0e07\u0e01\u0e24\u0e29 VIP',
  parser: 'englandvip',
  syncToResults: true,
  provider: 'englandvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'germany_vip',
  lotteryCode: 'germany_vip',
  marketName: '\u0e40\u0e22\u0e2d\u0e23\u0e21\u0e31\u0e19 VIP',
  parser: 'germanyvip',
  syncToResults: true,
  provider: 'germanyvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'russia_vip',
  lotteryCode: 'russia_vip',
  marketName: '\u0e23\u0e31\u0e2a\u0e40\u0e0a\u0e35\u0e22 VIP',
  parser: 'russiavip',
  syncToResults: true,
  provider: 'russiavip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'korea_vip',
  lotteryCode: 'korea_vip',
  marketName: '\u0e40\u0e01\u0e32\u0e2b\u0e25\u0e35 VIP',
  parser: 'koreavip',
  syncToResults: true,
  provider: 'koreavip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'taiwan_vip',
  lotteryCode: 'taiwan_vip',
  marketName: '\u0e44\u0e15\u0e49\u0e2b\u0e27\u0e31\u0e19 VIP',
  parser: 'taiwanvip',
  syncToResults: true,
  provider: 'taiwanvip'
});

EXTRA_SYNC_CONFIGS.push({
  feedCode: 'singapore_vip',
  lotteryCode: 'singapore_vip',
  marketName: '\u0e2a\u0e34\u0e07\u0e04\u0e42\u0e1b\u0e23\u0e4c VIP',
  parser: 'singaporevip',
  syncToResults: true,
  provider: 'singaporevip'
});

const SYNC_CONFIGS = [...FEED_CONFIGS, ...EXTRA_SYNC_CONFIGS];

for (const config of FEED_CONFIGS) {
  if (config.feedCode === 'tlzc') {
    config.provider = 'huaylao';
  }

  if (config.feedCode === 'zcvip') {
    config.provider = 'laosvip';
  }

  if (config.feedCode === 'gsus') {
    config.provider = 'dowjonesvip';
    config.parser = 'dowjonesvip';
  }
}

const OFFICIAL_PROVIDER_CODES = new Set([
  'gsb',
  'thaiglo',
  'baacofficial',
  'huaylao',
  'laosvip',
  'laosredcross',
  'laospathana',
  'laostv',
  'laoshd',
  'laoextra',
  'laostars',
  'laostarsvip',
  'laosunion',
  'laosunionvip',
  'laosasean',
  'hanoiextra',
  'hanoistar',
  'hanoidevelop',
  'hanoihd',
  'hanoitv',
  'hanoiredcross',
  'hanoiunion',
  'hanoiasean',
  'shenzhenmorningvip',
  'shenzhenafternoonvip',
  'hsimorningvip',
  'hsiafternoonvip',
  'nikkeimorningvip',
  'nikkeiafternoonvip',
  'englandvip',
  'germanyvip',
  'russiavip',
  'koreavip',
  'taiwanvip',
  'singaporevip',
  'dowjonesvip'
]);
const isConfigMappingCovered = (config) => Boolean(
  OFFICIAL_PROVIDER_CODES.has(config?.provider)
  || EXPLICIT_FEED_MAPPINGS[config?.feedCode]
);

const getFeedMappingMode = (configOrFeedCode) => {
  const config = typeof configOrFeedCode === 'string'
    ? SYNC_CONFIGS.find((item) => item.feedCode === configOrFeedCode) || { feedCode: configOrFeedCode }
    : configOrFeedCode || {};

  if (OFFICIAL_PROVIDER_CODES.has(config.provider)) {
    return 'official-page';
  }

  return EXPLICIT_FEED_MAPPINGS[config.feedCode] ? 'explicit' : 'legacy-fallback';
};

const getMappingCoverageSummary = () => {
  const coveredConfigs = SYNC_CONFIGS.filter((config) => isConfigMappingCovered(config));
  const missingFeedCodes = SYNC_CONFIGS
    .filter((config) => !isConfigMappingCovered(config))
    .map((config) => config.feedCode);

  return {
    strictMode: STRICT_FEED_MAPPING,
    configuredCount: SYNC_CONFIGS.length,
    explicitCount: coveredConfigs.length,
    missingCount: missingFeedCodes.length,
    missingFeedCodes
  };
};

const syncState = {
  running: false,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  lastSummary: null
};

let autoSyncTimer = null;
let autoSyncStartupTimer = null;

const flattenValues = (value) => Array.isArray(value) ? value.flatMap(flattenValues) : [value];
const joinDigits = (value) => String(value || '').replace(/\D/g, '');
const uniqueDigits = (value) => [...new Set(flattenValues(value).map(joinDigits).filter(Boolean))];
const combineUniqueDigits = (...values) => [...new Set(values.flatMap((value) => uniqueDigits(value)).filter(Boolean))];
const tailDigits = (value, length) => {
  const digits = joinDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};
const twoDigitScalar = (value) => {
  const digits = joinDigits(value);
  return digits.length === 2 ? digits : '';
};
const middleDigits = (value, length) => {
  const digits = joinDigits(value);
  if (!digits) return '';
  if (digits.length <= length) return digits;
  const start = Math.floor((digits.length - length) / 2);
  return digits.slice(start, start + length);
};
const parseIssueToRoundCode = (value) => {
  const digits = joinDigits(value);
  if (digits.length < 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const parseBangkokDateTime = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  return createBangkokDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
};

const getValueByPath = (source, path) => path
  .split('.')
  .reduce((current, segment) => current == null ? undefined : current[segment], source);

const readMappedScalar = (row, fieldConfig) => {
  if (!fieldConfig?.path) return '';
  const value = getValueByPath(row, fieldConfig.path);
  return fieldConfig.transform ? fieldConfig.transform(value, row) : joinDigits(value);
};

const readMappedList = (row, fieldConfig) => {
  if (!fieldConfig?.path) return [];
  const value = getValueByPath(row, fieldConfig.path);
  const result = fieldConfig.transform ? fieldConfig.transform(value, row) : uniqueDigits(value);
  return Array.isArray(result) ? result.filter(Boolean) : uniqueDigits(result);
};

const toHeadline = (...candidates) => {
  for (const candidate of candidates) {
    const value = joinDigits(candidate);
    if (value) return value;
  }
  return '';
};

const buildRunDigits = (values) => [...new Set(values.join('').split('').filter(Boolean))];
const getSettlementSafety = (config) => Boolean(config.syncToResults);

const buildGovernmentSnapshot = (config, row, mapping = EXPLICIT_FEED_MAPPINGS[config.feedCode]) => {
  const firstPrize = readMappedScalar(row, mapping?.firstPrize) || joinDigits(row?.code?.code);
  const frontThreeHits = readMappedList(row, mapping?.threeFrontHits);
  const backThreeHits = readMappedList(row, mapping?.threeBottomHits);
  const twoBottom = readMappedScalar(row, mapping?.twoBottom) || joinDigits(row?.code?.code3);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, twoBottom),
      firstPrize,
      threeTop,
      threeFront: frontThreeHits[0] || '',
      twoTop,
      twoBottom,
      threeBottom: backThreeHits[0] || '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: frontThreeHits,
      threeBottomHits: backThreeHits,
      runTop: buildRunDigits(threeTop ? [threeTop] : []),
      runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row,
    legacyGovernmentPayload: {
      roundDate: parseIssueToRoundCode(row?.officialissue || row?.issue),
      firstPrize,
      threeTopList: frontThreeHits,
      threeBotList: backThreeHits,
      twoBottom,
      runTop: buildRunDigits(threeTop ? [threeTop] : []),
      runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
      fetchedAt: new Date()
    }
  };
};

const buildGenericSnapshot = (config, row, mapping) => {
  const firstPrize = readMappedScalar(row, mapping.firstPrize);
  const threeTop = readMappedScalar(row, mapping.threeTop);
  const threeFront = readMappedScalar(row, mapping.threeFront);
  const twoTop = readMappedScalar(row, mapping.twoTop);
  const twoBottom = readMappedScalar(row, mapping.twoBottom);
  const threeBottom = readMappedScalar(row, mapping.threeBottom);
  const threeTopHits = readMappedList(row, mapping.threeTopHits);
  const twoTopHits = readMappedList(row, mapping.twoTopHits);
  const twoBottomHits = readMappedList(row, mapping.twoBottomHits);
  const threeFrontHits = readMappedList(row, mapping.threeFrontHits);
  const threeBottomHits = readMappedList(row, mapping.threeBottomHits);
  const normalizedThreeTopHits = threeTopHits.length ? threeTopHits : (threeTop ? [threeTop] : []);
  const normalizedTwoTopHits = twoTopHits.length ? twoTopHits : (twoTop ? [twoTop] : []);
  const normalizedTwoBottomHits = twoBottomHits.length ? twoBottomHits : (twoBottom ? [twoBottom] : []);
  const normalizedThreeFrontHits = threeFrontHits.length ? threeFrontHits : (threeFront ? [threeFront] : []);
  const normalizedThreeBottomHits = threeBottomHits.length ? threeBottomHits : (threeBottom ? [threeBottom] : []);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
    headline: toHeadline(firstPrize, threeTop, twoBottom, twoTop),
    firstPrize,
    threeTop,
    threeFront,
    twoTop,
    twoBottom,
    threeBottom,
    threeTopHits: normalizedThreeTopHits,
    twoTopHits: normalizedTwoTopHits,
    twoBottomHits: normalizedTwoBottomHits,
    threeFrontHits: normalizedThreeFrontHits,
    threeBottomHits: normalizedThreeBottomHits,
    runTop: buildRunDigits(normalizedThreeTopHits),
    runBottom: buildRunDigits(normalizedTwoBottomHits),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildSimpleSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeTop = joinDigits(row?.code?.code_last3) || tailDigits(firstPrize, 3);
  const twoTop = joinDigits(row?.code?.code_last2) || tailDigits(firstPrize, 2);
  const twoBottom =
    tailDigits(row?.code?.code1, 2) ||
    twoDigitScalar(row?.code?.code2) ||
    joinDigits(row?.code?.code_pre2) ||
    joinDigits(row?.code?.code_mid2) ||
    '';

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, threeTop, twoBottom, twoTop),
      firstPrize,
      threeTop,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeTop ? [threeTop] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildStockSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeDigits = firstPrize;
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = joinDigits(row?.code?.code1);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, twoBottom, twoTop),
      firstPrize,
      threeTop: threeDigits,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeDigits ? [threeDigits] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeDigits ? [threeDigits] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const buildBaacSnapshot = (config, row) => {
  const firstPrize = joinDigits(row?.code?.code);
  const threeTop = tailDigits(firstPrize, 3);
  const twoTop = tailDigits(firstPrize, 2);
  const twoBottom = middleDigits(firstPrize, 2);

  return {
    lotteryCode: config.lotteryCode,
    feedCode: config.feedCode,
    marketName: config.marketName,
    roundCode: parseIssueToRoundCode(row?.officialissue || row?.issue),
      headline: toHeadline(firstPrize, threeTop, twoBottom),
      firstPrize,
      threeTop,
      threeFront: '',
      twoTop,
      twoBottom,
      threeBottom: '',
      threeTopHits: threeTop ? [threeTop] : [],
      twoTopHits: twoTop ? [twoTop] : [],
      twoBottomHits: twoBottom ? [twoBottom] : [],
      threeFrontHits: [],
      threeBottomHits: [],
    runTop: buildRunDigits(threeTop ? [threeTop] : []),
    runBottom: buildRunDigits(twoBottom ? [twoBottom] : []),
    resultPublishedAt: parseBangkokDateTime(row?.opendate),
    isSettlementSafe: getSettlementSafety(config),
    sourceUrl: `${MANYCAI_FEED_BASE_URL}/${config.feedCode}.json`,
    rawPayload: row
  };
};

const snapshotBuilders = {
  government: buildGovernmentSnapshot,
  simple: buildSimpleSnapshot,
  stock: buildStockSnapshot,
  baac: buildBaacSnapshot
};

const describeUnexpectedFeedPayload = (payload) => {
  if (typeof payload === 'string') {
    const normalized = payload.trim();
    if (!normalized) {
      return 'Empty text payload';
    }
    if (normalized.startsWith('<') || /<html/i.test(normalized) || /_Incapsula_Resource/i.test(normalized)) {
      return 'Feed blocked or returned HTML payload';
    }
    return 'Feed returned text payload';
  }

  if (Array.isArray(payload)) {
    return 'Feed returned array payload';
  }

  if (payload && typeof payload === 'object') {
    return 'Feed returned object payload';
  }

  return `Feed returned ${typeof payload} payload`;
};

const fetchFeedRows = async (feedCode) => {
  const response = await axios.get(`${MANYCAI_FEED_BASE_URL}/${feedCode}.json`, {
    timeout: RESULT_SYNC_TIMEOUT_MS
  });

  if (!Array.isArray(response.data)) {
    throw new Error(`${describeUnexpectedFeedPayload(response.data)} for ${feedCode}`);
  }

  return response.data;
};

const fetchSyncRows = async (config) => {
  if (config.provider === 'gsb') {
    const snapshots = await fetchGsbSnapshots({ limit: GSB_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'thaiglo') {
    const snapshots = await fetchThaiGovernmentSnapshots({ limit: THAI_GOV_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'baacofficial') {
    const snapshots = await fetchBaacSnapshots({ limit: BAAC_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'huaylao') {
    const snapshots = await fetchLaosSnapshots({ limit: LAOS_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laosvip') {
    const snapshots = await fetchLaosVipSnapshots({ limit: LAOS_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laosredcross') {
    const snapshots = await fetchLaosRedcrossSnapshots({ limit: LAOS_REDCROSS_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laospathana') {
    const snapshots = await fetchLaosPathanaSnapshots({ limit: LAOS_PATHANA_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laostv') {
    const snapshots = await fetchLaosTvSnapshots({ limit: LAOS_TV_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laoshd') {
    const snapshots = await fetchLaosHdSnapshots({ limit: LAOS_HD_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laoextra') {
    const snapshots = await fetchLaosExtraSnapshots({ limit: LAOS_EXTRA_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laostars') {
    const snapshots = await fetchLaosStarsSnapshots({ limit: LAOS_STAR_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laostarsvip') {
    const snapshots = await fetchLaosStarsVipSnapshots({ limit: LAOS_STAR_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laosunion') {
    const snapshots = await fetchLaosUnionSnapshots({ limit: LAOS_UNION_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laosunionvip') {
    const snapshots = await fetchLaosUnionVipSnapshots({ limit: LAOS_UNION_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'laosasean') {
    const snapshots = await fetchLaosAseanSnapshots({ limit: LAOS_ASEAN_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoiextra') {
    const snapshots = await fetchHanoiExtraSnapshots({ limit: HANOI_EXTRA_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoistar') {
    const snapshots = await fetchHanoiStarSnapshots({ limit: HANOI_STAR_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoidevelop') {
    const snapshots = await fetchHanoiDevelopSnapshots({ limit: HANOI_DEVELOP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoihd') {
    const snapshots = await fetchHanoiHdSnapshots({ limit: HANOI_HD_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoitv') {
    const snapshots = await fetchHanoiTvSnapshots({ limit: HANOI_TV_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoiredcross') {
    const snapshots = await fetchHanoiRedcrossSnapshots({ limit: HANOI_REDCROSS_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoiunion') {
    const snapshots = await fetchHanoiUnionSnapshots({ limit: HANOI_UNION_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hanoiasean') {
    const snapshots = await fetchHanoiAseanSnapshots({ limit: HANOI_ASEAN_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'shenzhenmorningvip') {
    const snapshots = await fetchShenzhenMorningVipSnapshots({ limit: SHENZHEN_MORNING_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'shenzhenafternoonvip') {
    const snapshots = await fetchShenzhenAfternoonVipSnapshots({ limit: SHENZHEN_AFTERNOON_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'nikkeimorningvip') {
    const snapshots = await fetchNikkeiMorningVipSnapshots({ limit: NIKKEI_MORNING_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'nikkeiafternoonvip') {
    const snapshots = await fetchNikkeiAfternoonVipSnapshots({ limit: NIKKEI_AFTERNOON_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'englandvip') {
    const snapshots = await fetchEnglandVipSnapshots({ limit: ENGLAND_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'germanyvip') {
    const snapshots = await fetchGermanyVipSnapshots({ limit: GERMANY_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'russiavip') {
    const snapshots = await fetchRussiaVipSnapshots({ limit: RUSSIA_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'koreavip') {
    const snapshots = await fetchKoreaVipSnapshots({ limit: KOREA_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'taiwanvip') {
    const snapshots = await fetchTaiwanVipSnapshots({ limit: TAIWAN_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'singaporevip') {
    const snapshots = await fetchSingaporeVipSnapshots({ limit: SINGAPORE_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'dowjonesvip') {
    const snapshots = await fetchDowjonesVipSnapshots({ limit: DOWJONES_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hsimorningvip') {
    const snapshots = await fetchHsiMorningVipSnapshots({ limit: HSI_MORNING_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  if (config.provider === 'hsiafternoonvip') {
    const snapshots = await fetchHsiAfternoonVipSnapshots({ limit: HSI_AFTERNOON_VIP_SYNC_LIMIT });
    return snapshots.map((snapshot) => ({ __snapshot: snapshot }));
  }

  return fetchFeedRows(config.feedCode);
};

const buildSnapshot = (config, row, { strict = STRICT_FEED_MAPPING } = {}) => {
  if (OFFICIAL_PROVIDER_CODES.has(config.provider)) {
    return row?.__snapshot || null;
  }

  const mapping = EXPLICIT_FEED_MAPPINGS[config.feedCode];
  if (!mapping && strict) {
    throw new Error(`Missing explicit mapping for feed ${config.feedCode}`);
  }
  if (mapping?.kind === 'government') {
    return buildGovernmentSnapshot(config, row, mapping);
  }
  if (mapping?.kind === 'generic') {
    return buildGenericSnapshot(config, row, mapping);
  }

  const builder = snapshotBuilders[config.parser];
  if (!builder) {
    throw new Error(`Parser "${config.parser}" is not supported`);
  }

  return builder(config, row);
};

const getRoundDrawAt = (lotteryType, roundCode) => {
  const match = String(roundCode || '').match(ROUND_CODE_PATTERN);
  if (!match || !lotteryType?.schedule) {
    return null;
  }

  return createBangkokDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(lotteryType.schedule.drawHour || 0),
    Number(lotteryType.schedule.drawMinute || 0),
    0
  );
};

const resolveSnapshotReleaseAt = (snapshot, round, lotteryType, config = {}) => {
  if (config?.releaseByPublishedAt && snapshot?.resultPublishedAt) {
    return new Date(snapshot.resultPublishedAt);
  }

  return round?.drawAt || getRoundDrawAt(lotteryType, snapshot?.roundCode);
};

const resolveProcessingRound = async (snapshot, lotteryType, config = {}, now = new Date()) => {
  if (!snapshot?.roundCode || !lotteryType) {
    return { round: null, released: true };
  }

  const round = await ensureRoundForLottery(lotteryType, snapshot.roundCode);
  const releaseAt = resolveSnapshotReleaseAt(snapshot, round, lotteryType, config);
  if (!releaseAt) {
    return { round, released: true };
  }

  return {
    round,
    released: now.getTime() >= new Date(releaseAt).getTime()
  };
};

const upsertSnapshot = async (snapshot, lotteryType) => {
  return MarketFeedResult.findOneAndUpdate(
    {
      feedCode: snapshot.feedCode,
      roundCode: snapshot.roundCode
    },
    {
      $set: {
        lotteryTypeId: lotteryType?._id || null,
        lotteryCode: snapshot.lotteryCode,
        marketName: snapshot.marketName,
        headline: snapshot.headline,
          firstPrize: snapshot.firstPrize,
          twoTop: snapshot.twoTop,
          twoBottom: snapshot.twoBottom,
          threeTop: snapshot.threeTop,
          threeFront: snapshot.threeFront,
          threeBottom: snapshot.threeBottom,
          threeTopHits: snapshot.threeTopHits,
          twoTopHits: snapshot.twoTopHits,
          twoBottomHits: snapshot.twoBottomHits,
          threeFrontHits: snapshot.threeFrontHits,
          threeBottomHits: snapshot.threeBottomHits,
        runTop: snapshot.runTop,
        runBottom: snapshot.runBottom,
        resultPublishedAt: snapshot.resultPublishedAt,
        isSettlementSafe: snapshot.isSettlementSafe,
        sourceUrl: snapshot.sourceUrl,
        rawPayload: snapshot.rawPayload
      }
    },
    {
      new: true,
      upsert: true
    }
  );
};

const upsertLegacyGovernmentResult = async (snapshot) => {
  const payload = snapshot.legacyGovernmentPayload;
  if (!payload?.roundDate || !payload.firstPrize) {
    return null;
  }

  const existing = await LotteryResult.findOne({ roundDate: payload.roundDate });
  if (existing) {
    Object.assign(existing, payload);
    return existing.save();
  }

  return LotteryResult.create(payload);
};

const resolveSyncExecutionMode = (options = {}) => {
  const runSettlement = options?.runSettlement !== false;
  return {
    runSettlement,
    mode: runSettlement ? 'full' : 'fetch-store'
  };
};

const runItemsInBatches = async (items, batchSize, worker) => {
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
  const results = [];

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    const chunk = items.slice(index, index + normalizedBatchSize);
    const chunkResults = await Promise.all(
      chunk.map((item, chunkIndex) => worker(item, index + chunkIndex))
    );
    results.push(...chunkResults);
  }

  return results;
};

const syncSnapshotToResults = async (snapshot, lotteryType, round = null, options = {}) => {
  const { runSettlement } = resolveSyncExecutionMode(options);

  if (!snapshot.isSettlementSafe || !lotteryType) {
    return { synced: false, settlement: null };
  }

  const targetRound = round || await ensureRoundForLottery(lotteryType, snapshot.roundCode);
  if (!targetRound) {
    throw new Error(`Round "${snapshot.roundCode}" not found for ${snapshot.lotteryCode}`);
  }

  await upsertRoundResult({
    roundId: targetRound._id,
    lotteryTypeId: lotteryType._id,
    resultData: {
      headline: snapshot.headline,
        firstPrize: snapshot.firstPrize,
        threeTop: snapshot.threeTop,
        threeFront: snapshot.threeFront,
        twoTop: snapshot.twoTop,
        twoBottom: snapshot.twoBottom,
        threeBottom: snapshot.threeBottom,
        threeTopHits: snapshot.threeTopHits,
        twoTopHits: snapshot.twoTopHits,
        twoBottomHits: snapshot.twoBottomHits,
        threeFrontHits: snapshot.threeFrontHits,
        threeBottomHits: snapshot.threeBottomHits,
      runTop: snapshot.runTop,
      runBottom: snapshot.runBottom
    },
    sourceType: 'api',
    sourceUrl: snapshot.sourceUrl,
    isPublished: true
  });

  if (!runSettlement) {
    return { synced: true, settlement: null, settlementDeferred: true };
  }

  const settlement = await settleRoundById(targetRound._id, { force: true });
  return { synced: true, settlement };
};

const processSyncConfig = async (config, lotteryByCode, executionMode) => {
  const feedSummary = {
    feedCode: config.feedCode,
    lotteryCode: config.lotteryCode,
    marketName: config.marketName,
    parser: config.parser,
    mappingMode: getFeedMappingMode(config),
    syncToResults: Boolean(config.syncToResults),
    settlementMode: executionMode.mode,
    fetchedRows: 0,
    processedRounds: 0,
    savedSnapshots: 0,
    syncedResults: 0,
    settlements: 0,
    skippedBeforeDraw: 0,
    warnings: [],
    status: 'ok',
    error: ''
  };

  const counters = {
    fetched: 0,
    savedSnapshots: 0,
    syncedResults: 0,
    settlements: 0,
    skipped: 0
  };
  const warnings = [];

  try {
    const rows = await fetchSyncRows(config);
    feedSummary.fetchedRows = rows.length;
    if (!rows.length) {
      counters.skipped += 1;
      const warning = `No data in feed ${config.feedCode}`;
      warnings.push(warning);
      feedSummary.warnings.push(warning);
      feedSummary.status = 'warning';
      return { feedSummary, counters, warnings };
    }

    const lotteryType = lotteryByCode.get(config.lotteryCode) || null;
    const processedRounds = new Set();

    for (const row of rows) {
      const snapshot = buildSnapshot(config, row);
      if (!snapshot.roundCode || !snapshot.headline || processedRounds.has(snapshot.roundCode)) {
        continue;
      }

      const { round, released } = await resolveProcessingRound(snapshot, lotteryType, config);
      if (!released) {
        counters.skipped += 1;
        feedSummary.skippedBeforeDraw += 1;
        continue;
      }

      processedRounds.add(snapshot.roundCode);
      await upsertSnapshot(snapshot, lotteryType);
      counters.fetched += 1;
      counters.savedSnapshots += 1;
      feedSummary.savedSnapshots += 1;

      if (snapshot.lotteryCode === 'thai_government') {
        await upsertLegacyGovernmentResult(snapshot);
      }

      if (config.syncToResults) {
        const result = await syncSnapshotToResults(snapshot, lotteryType, round, executionMode);
        if (result.synced) {
          counters.syncedResults += 1;
          feedSummary.syncedResults += 1;
        }
        if (result.settlement) {
          counters.settlements += 1;
          feedSummary.settlements += 1;
        }
      }
    }

    feedSummary.processedRounds = processedRounds.size;
    if (!processedRounds.size) {
      counters.skipped += 1;
      const warning = feedSummary.skippedBeforeDraw === rows.length
        ? `No released results yet for ${config.feedCode}`
        : `Incomplete snapshot for ${config.feedCode}`;
      warnings.push(warning);
      feedSummary.warnings.push(warning);
      feedSummary.status = 'warning';
    } else if (feedSummary.warnings.length) {
      feedSummary.status = 'warning';
    }
  } catch (error) {
    const warning = `${config.feedCode}: ${error.message}`;
    warnings.push(warning);
    feedSummary.warnings.push(warning);
    feedSummary.status = 'error';
    feedSummary.error = error.message;
  }

  return { feedSummary, counters, warnings };
};

const syncLatestExternalResults = async (options = {}) => {
  const executionMode = resolveSyncExecutionMode(options);

  if (syncState.running) {
    return {
      skipped: true,
      reason: 'sync-already-running',
      ...syncState.lastSummary
    };
  }

  syncState.running = true;
  syncState.lastStartedAt = new Date().toISOString();
  syncState.lastError = null;

  try {
    const lotteryTypes = await LotteryType.find({
      code: { $in: SYNC_CONFIGS.map((config) => config.lotteryCode) }
    });
    const lotteryByCode = new Map(lotteryTypes.map((item) => [item.code, item]));
    const summary = {
      syncedAt: new Date().toISOString(),
      mode: executionMode.mode,
      runSettlement: executionMode.runSettlement,
      batchSize: executionMode.runSettlement ? Math.min(RESULT_SYNC_BATCH_SIZE, 3) : RESULT_SYNC_BATCH_SIZE,
      fetched: 0,
      savedSnapshots: 0,
      syncedResults: 0,
      settlements: 0,
      skipped: 0,
      snapshotRebuilt: false,
      snapshotError: '',
      warnings: [],
      strictMapping: STRICT_FEED_MAPPING,
      mappingCoverage: getMappingCoverageSummary(),
      feedSummaries: []
    };
    const feedResults = await runItemsInBatches(
      SYNC_CONFIGS,
      summary.batchSize,
      (config) => processSyncConfig(config, lotteryByCode, executionMode)
    );

    summary.feedSummaries = feedResults.map((item) => item.feedSummary);
    feedResults.forEach(({ counters, warnings }) => {
      summary.fetched += counters.fetched;
      summary.savedSnapshots += counters.savedSnapshots;
      summary.syncedResults += counters.syncedResults;
      summary.settlements += counters.settlements;
      summary.skipped += counters.skipped;
      summary.warnings.push(...warnings);
    });

    summary.okFeeds = summary.feedSummaries.filter((feed) => feed.status === 'ok').length;
    summary.warningFeeds = summary.feedSummaries.filter((feed) => feed.status === 'warning').length;
    summary.errorFeeds = summary.feedSummaries.filter((feed) => feed.status === 'error').length;

    try {
      const { rebuildMarketOverviewSnapshot } = require('./marketResultsService');
      const { clearCatalogOverviewCache } = require('./catalogService');
      await rebuildMarketOverviewSnapshot();
      clearCatalogOverviewCache();
      summary.snapshotRebuilt = true;
    } catch (error) {
      summary.snapshotError = error.message || 'Failed to rebuild market overview snapshot';
      summary.warnings.push(`market-overview-snapshot: ${summary.snapshotError}`);
    }

    syncState.lastCompletedAt = new Date().toISOString();
    syncState.lastSummary = summary;
    return summary;
  } catch (error) {
    syncState.lastError = error.message;
    throw error;
  } finally {
    syncState.running = false;
  }
};

const getStoredLatestExternalResults = async ({ lotteryId = null, limit = 50 } = {}) => {
  const fetchLimit = Math.max(limit * 3, limit + 20);
  const query = lotteryId ? { lotteryTypeId: lotteryId } : {};
  const items = await MarketFeedResult.find(query)
    .sort({ resultPublishedAt: -1, updatedAt: -1 })
    .limit(fetchLimit)
    .populate('lotteryTypeId', 'code name shortName provider schedule');
  const now = new Date();

  return items
    .filter((item) => {
      const drawAt = getRoundDrawAt(item.lotteryTypeId, item.roundCode);
      return !drawAt || drawAt.getTime() <= now.getTime();
    })
    .slice(0, limit)
    .map((item) => ({
    id: `feed-${item._id.toString()}`,
    lotteryTypeId: item.lotteryTypeId?._id?.toString() || item.lotteryTypeId?.toString() || null,
    lotteryCode: item.lotteryTypeId?.code || item.lotteryCode,
    lotteryName: item.lotteryTypeId?.name || item.marketName,
    lotteryShortName: item.lotteryTypeId?.shortName || '',
    provider: item.lotteryTypeId?.provider || 'ManyCai Feed',
    roundCode: item.roundCode,
    roundTitle: item.roundCode ? `งวด ${item.roundCode}` : '',
    drawAt: item.resultPublishedAt,
    resultPublishedAt: item.resultPublishedAt || item.updatedAt,
    headline: item.headline || item.firstPrize || item.twoBottom || '-',
      firstPrize: item.firstPrize || '',
      twoTop: item.twoTop || '',
      twoBottom: item.twoBottom || '',
      threeTop: item.threeTop || '',
      threeFront: item.threeFront || '',
      threeBottom: item.threeBottom || '',
      threeTopHits: item.threeTopHits || [],
      twoTopHits: item.twoTopHits || [],
      twoBottomHits: item.twoBottomHits || [],
      threeFrontHits: item.threeFrontHits || [],
      threeBottomHits: item.threeBottomHits || [],
    runTop: item.runTop || [],
    runBottom: item.runBottom || [],
    sourceType: 'api',
    sourceUrl: item.sourceUrl || '',
    isExternalSnapshot: true
  }));
};

const getExternalSyncState = () => ({
  ...syncState,
  feedBaseUrl: MANYCAI_FEED_BASE_URL,
  strictMapping: STRICT_FEED_MAPPING,
  mappingCoverage: getMappingCoverageSummary(),
  feeds: SYNC_CONFIGS.map((config) => ({
    feedCode: config.feedCode,
    lotteryCode: config.lotteryCode,
    marketName: config.marketName,
    parser: config.parser,
    syncToResults: Boolean(config.syncToResults),
    provider: config.provider || 'manycai',
    mappingMode: getFeedMappingMode(config)
  }))
});

const startExternalResultAutoSync = (intervalMs, { startupDelayMs = RESULT_SYNC_STARTUP_DELAY_MS } = {}) => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }
  if (autoSyncStartupTimer) {
    clearTimeout(autoSyncStartupTimer);
  }
  autoSyncTimer = null;
  autoSyncStartupTimer = null;

  const runSync = async () => {
    try {
      const summary = await syncLatestExternalResults();
      console.log(`External result sync finished: ${JSON.stringify(summary)}`);
    } catch (error) {
      console.error('External result sync error:', error.message);
      syncState.lastError = error.message;
    }
  };

  const startInterval = () => {
    autoSyncTimer = setInterval(runSync, intervalMs);
  };
  const normalizedStartupDelayMs = Math.max(0, Number(startupDelayMs) || 0);

  if (normalizedStartupDelayMs > 0) {
    autoSyncStartupTimer = setTimeout(() => {
      autoSyncStartupTimer = null;
      runSync();
      startInterval();
    }, normalizedStartupDelayMs);
    return autoSyncStartupTimer;
  }

  runSync();
  startInterval();
  return autoSyncTimer;
};

const fetchThaiGovernmentResultByRoundCode = async (roundCode) => {
  const snapshot =
    await fetchThaiGovernmentSnapshotByRoundCode(roundCode)
    || await fetchLatestThaiGovernmentSnapshot().catch(() => null);
  if (!snapshot) {
    return null;
  }
  return snapshot.legacyGovernmentPayload || null;
};

module.exports = {
  MANYCAI_FEED_BASE_URL,
  FEED_CONFIGS,
  SYNC_CONFIGS,
  EXPLICIT_FEED_MAPPINGS,
  STRICT_FEED_MAPPING,
  buildSnapshot,
  fetchFeedRows,
  fetchThaiGovernmentResultByRoundCode,
  resolveSnapshotReleaseAt,
  resolveSyncExecutionMode,
  runItemsInBatches,
  syncLatestExternalResults,
  startExternalResultAutoSync,
  getStoredLatestExternalResults,
  getExternalSyncState
};
