const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const DrawRound = require('../models/DrawRound');
const ResultRecord = require('../models/ResultRecord');
const {
  fetchLatestThaiGovernmentSnapshot,
  fetchThaiGovernmentSnapshotByRoundCode
} = require('./thaiGovernmentResultService');
const {
  ensureRoundForLottery,
  settleRoundById,
  upsertRoundResult
} = require('./resultService');

const THAI_GOV_LOTTERY_CODE = 'thai_government';

const toUniqueDigits = (values) => [...new Set((values || []).map((value) => String(value || '').replace(/\D/g, '')).filter(Boolean))];
const tailDigits = (value, length) => String(value || '').replace(/\D/g, '').slice(-length);

const normalizeLegacyPayload = (resultData = {}) => {
  const firstPrize = String(resultData.firstPrize || '').replace(/\D/g, '');
  const roundDate = String(resultData.roundDate || '').trim();
  const twoBottom = String(resultData.twoBottom || '').replace(/\D/g, '') || tailDigits(firstPrize, 2);
  const threeTopList = toUniqueDigits(resultData.threeTopList || []);
  const threeBotList = toUniqueDigits(resultData.threeBotList || []);
  const runTop = toUniqueDigits(resultData.runTop || (firstPrize ? firstPrize.slice(-3).split('') : []));
  const runBottom = toUniqueDigits(resultData.runBottom || (twoBottom ? twoBottom.split('') : []));

  return {
    roundDate,
    firstPrize,
    threeTopList,
    threeBotList,
    twoBottom,
    runTop,
    runBottom,
    fetchedAt: resultData.fetchedAt || new Date(),
    sourceType: resultData.sourceType || 'manual',
    sourceUrl: String(resultData.sourceUrl || '').trim()
  };
};

const snapshotToLegacyPayload = (snapshot) => {
  if (!snapshot?.roundCode || !snapshot?.firstPrize) {
    return null;
  }

  return normalizeLegacyPayload({
    roundDate: snapshot.roundCode,
    firstPrize: snapshot.firstPrize,
    threeTopList: snapshot.threeFrontHits || [],
    threeBotList: snapshot.threeBottomHits || [],
    twoBottom: snapshot.twoBottom,
    runTop: snapshot.runTop || [],
    runBottom: snapshot.runBottom || [],
    fetchedAt: snapshot.resultPublishedAt || new Date(),
    sourceType: 'api',
    sourceUrl: snapshot.sourceUrl || ''
  });
};

const upsertLegacyLotteryResult = async (payload) => {
  const existing = await LotteryResult.findOne({ roundDate: payload.roundDate });
  if (existing) {
    Object.assign(existing, payload);
    return existing.save();
  }

  return LotteryResult.create(payload);
};

const buildOfficialResultData = (payload) => ({
  headline: payload.firstPrize || payload.twoBottom,
  firstPrize: payload.firstPrize,
  threeTop: tailDigits(payload.firstPrize, 3),
  twoTop: tailDigits(payload.firstPrize, 2),
  twoBottom: payload.twoBottom,
  threeFront: payload.threeTopList[0] || '',
  threeFrontHits: payload.threeTopList,
  threeBottom: payload.threeBotList[0] || '',
  threeBottomHits: payload.threeBotList,
  runTop: payload.runTop,
  runBottom: payload.runBottom
});

const loadThaiGovernmentLottery = async () => {
  const lotteryType = await LotteryType.findOne({ code: THAI_GOV_LOTTERY_CODE });
  if (!lotteryType) {
    const error = new Error('Thai government lottery type not found');
    error.statusCode = 404;
    throw error;
  }

  return lotteryType;
};

const fetchLotteryResult = async (roundDate) => {
  const snapshot = await fetchThaiGovernmentSnapshotByRoundCode(roundDate);
  if (!snapshot) {
    const error = new Error(`No official Thai government result found for ${roundDate}`);
    error.statusCode = 404;
    throw error;
  }

  return snapshotToLegacyPayload(snapshot);
};

const saveLotteryResult = async (resultData) => {
  const payload = normalizeLegacyPayload(resultData);
  if (!payload.roundDate || !payload.firstPrize) {
    const error = new Error('Round date and first prize are required');
    error.statusCode = 400;
    throw error;
  }

  const lotteryType = await loadThaiGovernmentLottery();
  const round = await ensureRoundForLottery(lotteryType, payload.roundDate);

  if (!round) {
    const error = new Error(`Round not found for ${payload.roundDate}`);
    error.statusCode = 404;
    throw error;
  }

  const savedLegacy = await upsertLegacyLotteryResult(payload);
  const syncedResult = await upsertRoundResult({
    roundId: round._id,
    lotteryTypeId: lotteryType._id,
    resultData: buildOfficialResultData(payload),
    sourceType: payload.sourceType || 'manual',
    sourceUrl: payload.sourceUrl || '',
    isPublished: true
  });
  const settlement = await settleRoundById(round._id, { force: true });

  return {
    result: savedLegacy,
    syncedResult,
    settlement
  };
};

const mapResultRecordToLegacy = (record, round) => {
  if (!record || !round?.code) return null;

  return {
    roundDate: round.code,
    firstPrize: record.firstPrize || '',
    threeTopList: toUniqueDigits(record.threeFrontHits || []),
    threeBotList: toUniqueDigits(record.threeBottomHits || []),
    twoBottom: record.twoBottom || '',
    runTop: toUniqueDigits(record.runTop || []),
    runBottom: toUniqueDigits(record.runBottom || []),
    isCalculated: true,
    fetchedAt: record.updatedAt || record.createdAt || new Date(),
    sourceType: record.sourceType || 'api',
    sourceUrl: record.sourceUrl || ''
  };
};

const loadThaiGovernmentResultRecords = async (limit = 20) => {
  const lotteryType = await loadThaiGovernmentLottery();
  const rounds = await DrawRound.find({
    lotteryTypeId: lotteryType._id,
    resultPublishedAt: { $ne: null }
  }).sort({ code: -1 }).limit(Math.max(1, Number(limit) || 1)).lean();
  const roundIds = rounds.map((round) => round._id);
  const records = await ResultRecord.find({
    drawRoundId: { $in: roundIds },
    isPublished: true
  }).lean();
  const recordMap = new Map(records.map((record) => [String(record.drawRoundId), record]));

  return rounds
    .map((round) => ({
      round,
      record: recordMap.get(String(round._id)) || null
    }))
    .filter((item) => item.record);
};

const getLatestResult = async () => {
  const [latest] = await loadThaiGovernmentResultRecords(1);
  if (latest) {
    return mapResultRecordToLegacy(latest.record, latest.round);
  }

  const latestSnapshot = await fetchLatestThaiGovernmentSnapshot().catch(() => null);
  return latestSnapshot ? snapshotToLegacyPayload(latestSnapshot) : null;
};

const getRecentResults = async (limit = 20) => {
  const entries = await loadThaiGovernmentResultRecords(limit);
  return entries
    .map(({ record, round }) => mapResultRecordToLegacy(record, round))
    .filter(Boolean)
    .slice(0, Math.max(1, Number(limit) || 1));
};

module.exports = {
  fetchLotteryResult,
  saveLotteryResult,
  getLatestResult,
  getRecentResults
};
