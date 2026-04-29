const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');
const CatalogOverviewSnapshot = require('../models/CatalogOverviewSnapshot');
const DrawRound = require('../models/DrawRound');
const LotteryLeague = require('../models/LotteryLeague');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const ResultRecord = require('../models/ResultRecord');
const User = require('../models/User');
const { getStoredLatestExternalResults } = require('./externalResultFeedService');
const {
  getMemberConfigRows,
  normalizeEnabledBetTypes,
  loadActiveLotteries
} = require('./memberManagementService');
const {
  createReferenceDataCache,
  loadWithReferenceCache,
  clearReferenceDataCache
} = require('../utils/referenceDataCache');
const {
  DEFAULT_RATE_TIERS,
  LOTTERY_LEAGUES,
  LOTTERY_TYPES,
  DEFAULT_ANNOUNCEMENTS
} = require('../constants/catalogDefinitions');
const { BET_TYPES, DEFAULT_GLOBAL_RATES } = require('../constants/betting');
const {
  createBangkokDate,
  formatBangkokDate,
  formatBangkokDateTime,
  getBangkokParts
} = require('../utils/bangkokTime');

const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_OVERVIEW_CACHE_MS = Math.max(0, Number(process.env.CATALOG_OVERVIEW_CACHE_MS || 60000));
const CATALOG_OVERVIEW_CACHE_MAX_ENTRIES = Math.max(1, Number(process.env.CATALOG_OVERVIEW_CACHE_MAX_ENTRIES || 200));
const CATALOG_OVERVIEW_SNAPSHOT_TTL_MS = Math.max(
  0,
  Number(process.env.CATALOG_OVERVIEW_SNAPSHOT_TTL_MS || CATALOG_OVERVIEW_CACHE_MS)
);
const CATALOG_OVERVIEW_STALE_MAX_MS = Math.max(
  CATALOG_OVERVIEW_SNAPSHOT_TTL_MS,
  Number(process.env.CATALOG_OVERVIEW_STALE_MAX_MS || 10 * 60 * 1000)
);
const CATALOG_REFERENCE_CACHE_MS = Math.max(
  1000,
  Number(process.env.CATALOG_REFERENCE_CACHE_MS || Math.min(CATALOG_OVERVIEW_CACHE_MS, 15000))
);
let catalogSeedPromise = null;
let catalogReadinessPromise = null;
const catalogOverviewCache = new Map();
const catalogOverviewInFlight = new Map();
const activeLeaguesCache = createReferenceDataCache({ ttlMs: CATALOG_REFERENCE_CACHE_MS });
const activeRoundsCache = createReferenceDataCache({ ttlMs: CATALOG_REFERENCE_CACHE_MS });
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const normalizeBettingOverride = (value) => (value === 'open' || value === 'closed' ? value : 'auto');
const normalizeRateMap = (value = {}, fallbackRates = {}) =>
  BET_TYPES.reduce((acc, betType) => {
    acc[betType] = Number(value?.[betType] ?? fallbackRates?.[betType] ?? DEFAULT_GLOBAL_RATES[betType] ?? 0);
    return acc;
  }, {});

const upsertByCode = (Model, code, payload) => Model.findOneAndUpdate(
  { code },
  { $set: payload },
  { new: true, upsert: true }
);

const loadActiveLeagues = async () =>
  loadWithReferenceCache(activeLeaguesCache, () =>
    LotteryLeague.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('code name description sortOrder isActive')
      .lean()
  );

const loadCatalogActiveRounds = async () =>
  loadWithReferenceCache(activeRoundsCache, () =>
    DrawRound.find({ isActive: true, drawAt: { $gte: new Date(Date.now() - 5 * DAY_MS) } })
      .sort({ drawAt: 1 })
      .select([
        'lotteryTypeId',
        'code',
        'title',
        'openAt',
        'closeAt',
        'drawAt',
        'isManualTiming',
        'timingUpdatedAt',
        'bettingOverride',
        'closedBetTypes',
        'resultPublishedAt'
      ].join(' '))
      .lean()
  );

const getBangkokWeekday = (date) => {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.getUTCDay();
};

const getRoundStatus = (round, now = new Date()) => {
  if (!round) {
    return {
      status: 'missing',
      label: 'ยังไม่มีงวด',
      countdownSeconds: null,
      bettingOverride: 'auto',
      isManualOverride: false
    };
  }

  if (round.resultPublishedAt) {
    return {
      status: 'resulted',
      label: 'ประกาศผลแล้ว',
      countdownSeconds: 0,
      bettingOverride: normalizeBettingOverride(round.bettingOverride),
      isManualOverride: false
    };
  }

  const bettingOverride = normalizeBettingOverride(round.bettingOverride);
  if (bettingOverride === 'open') {
    return {
      status: 'open',
      label: '\u0e40\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e40\u0e14\u0e34\u0e21\u0e1e\u0e31\u0e19',
      countdownSeconds: Math.max(0, Math.floor((round.closeAt - now) / 1000)),
      bettingOverride,
      isManualOverride: true
    };
  }

  if (bettingOverride === 'closed') {
    return {
      status: 'closed',
      label: '\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a \u0e23\u0e2d\u0e1c\u0e25',
      countdownSeconds: Math.max(0, Math.floor((round.drawAt - now) / 1000)),
      bettingOverride,
      isManualOverride: true
    };
  }

  if (now < round.openAt) {
    return {
      status: 'upcoming',
      label: 'กำลังจะเปิดรับ',
      countdownSeconds: Math.max(0, Math.floor((round.openAt - now) / 1000)),
      bettingOverride,
      isManualOverride: false
    };
  }

  if (now >= round.openAt && now <= round.closeAt) {
    return {
      status: 'open',
      label: 'เปิดรับเดิมพัน',
      countdownSeconds: Math.max(0, Math.floor((round.closeAt - now) / 1000)),
      bettingOverride,
      isManualOverride: false
    };
  }

  return {
    status: 'closed',
    label: 'ปิดรับ รอผล',
    countdownSeconds: Math.max(0, Math.floor((round.drawAt - now) / 1000)),
    bettingOverride,
    isManualOverride: false
  };
};

const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseRoundTimingDate = (value, fieldName) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw createValidationError(`${fieldName} must be a valid date`);
  }
  return date;
};

const normalizeRoundTimingPayload = (payload = {}, round = {}) => {
  const openAt = parseRoundTimingDate(payload.openAt, 'openAt');
  const closeAt = parseRoundTimingDate(payload.closeAt, 'closeAt');

  if (openAt.getTime() >= closeAt.getTime()) {
    throw createValidationError('openAt must be before closeAt');
  }

  if (round.drawAt) {
    const drawAt = new Date(round.drawAt);
    if (!Number.isNaN(drawAt.getTime()) && closeAt.getTime() > drawAt.getTime()) {
      throw createValidationError('closeAt must be before or equal to drawAt');
    }
  }

  return { openAt, closeAt };
};

const buildMonthlyOccurrences = (schedule, startDate, horizonDays) => {
  const occurrences = [];
  const start = new Date(startDate.getTime() - schedule.openLeadDays * DAY_MS);
  const end = new Date(startDate.getTime() + horizonDays * DAY_MS);

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const parts = getBangkokParts(cursor);
    if (!schedule.days.includes(parts.day)) continue;

    const drawAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.drawHour, schedule.drawMinute);
    const closeAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.closeHour, schedule.closeMinute);
    const openAt = new Date(drawAt.getTime() - schedule.openLeadDays * DAY_MS);

    occurrences.push({
      code: formatBangkokDate(drawAt),
      title: `งวด ${formatBangkokDate(drawAt)}`,
      openAt,
      closeAt,
      drawAt
    });
  }

  return occurrences;
};

const buildDailyOccurrences = (schedule, startDate, horizonDays) => {
  const occurrences = [];
  const start = new Date(startDate.getTime() - DAY_MS);
  const end = new Date(startDate.getTime() + horizonDays * DAY_MS);

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const parts = getBangkokParts(cursor);
    const drawAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.drawHour, schedule.drawMinute);
    const weekday = getBangkokWeekday(drawAt);
    if (schedule.weekdays && !schedule.weekdays.includes(weekday)) continue;

    const closeAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.closeHour, schedule.closeMinute);
    const openAt = new Date(drawAt.getTime() - schedule.openLeadDays * DAY_MS);

    occurrences.push({
      code: formatBangkokDate(drawAt),
      title: `รอบ ${formatBangkokDate(drawAt)}`,
      openAt,
      closeAt,
      drawAt
    });
  }

  return occurrences;
};

const generateOccurrences = (schedule, startDate = new Date(), horizonDays = 45) => {
  if (schedule.type === 'monthly') {
    return buildMonthlyOccurrences(schedule, startDate, horizonDays);
  }
  return buildDailyOccurrences(schedule, startDate, horizonDays);
};

const buildRoundUpsertOperations = (lotteryType, occurrences) => occurrences.map((occurrence) => {
  const status = getRoundStatus(occurrence).status;
  return {
    updateOne: {
      filter: {
        lotteryTypeId: lotteryType._id,
        code: occurrence.code
      },
      update: {
        $set: {
          isActive: true
        },
        $setOnInsert: {
          title: occurrence.title,
          openAt: occurrence.openAt,
          closeAt: occurrence.closeAt,
          drawAt: occurrence.drawAt,
          status,
          isManualTiming: false
        }
      },
      upsert: true
    }
  };
});

const ensureRoundsForLottery = async (lotteryType) => {
  const occurrences = generateOccurrences(lotteryType.schedule);
  const operations = buildRoundUpsertOperations(lotteryType, occurrences);

  if (!operations.length) {
    return;
  }

  await DrawRound.bulkWrite(operations, { ordered: false });
};

const runCatalogSeed = async () => {
  const rateProfiles = [];
  for (const rateTier of DEFAULT_RATE_TIERS) {
    const rateProfile = await upsertByCode(RateProfile, rateTier.code, rateTier);
    rateProfiles.push(rateProfile);
  }

  await RateProfile.updateMany(
    { code: { $nin: DEFAULT_RATE_TIERS.map((tier) => tier.code) } },
    { $set: { isActive: false, isDefault: false } }
  );

  const rateProfileIds = rateProfiles.map((profile) => profile._id);
  const defaultRateProfile = rateProfiles.find((profile) => profile.isDefault) || rateProfiles[0];

  const leaguesByCode = {};
  for (const league of LOTTERY_LEAGUES) {
    leaguesByCode[league.code] = await upsertByCode(LotteryLeague, league.code, league);
  }

  for (let index = 0; index < LOTTERY_TYPES.length; index++) {
    const definition = LOTTERY_TYPES[index];
    const lotteryType = await upsertByCode(LotteryType, definition.code, {
      ...definition,
      leagueId: leaguesByCode[definition.leagueCode]._id,
      sortOrder: index + 1,
      rateProfileIds,
      defaultRateProfileId: defaultRateProfile?._id || null
    });

    await ensureRoundsForLottery(lotteryType);
  }

  for (const announcement of DEFAULT_ANNOUNCEMENTS) {
    await upsertByCode(Announcement, announcement.code, announcement);
  }
};

const createCatalogUnavailableError = (message) => {
  const error = new Error(message);
  error.status = 503;
  return error;
};

const verifyCatalogSeeded = async () => {
  const [leagueCount, lotteryCount, rateProfileCount, announcementCount, activeRoundCount] = await Promise.all([
    LotteryLeague.countDocuments({ isActive: true }),
    LotteryType.countDocuments({ isActive: true }),
    RateProfile.countDocuments({ isActive: true }),
    Announcement.countDocuments({ isActive: true }),
    DrawRound.countDocuments({ isActive: true, drawAt: { $gte: new Date(Date.now() - 5 * DAY_MS) } })
  ]);

  if (!leagueCount || !lotteryCount || !rateProfileCount) {
    throw createCatalogUnavailableError('Catalog seed is missing. Run `npm run catalog:seed` before serving requests.');
  }

  if (!announcementCount) {
    throw createCatalogUnavailableError('Catalog announcements are missing. Run `npm run catalog:seed` before serving requests.');
  }

  if (!activeRoundCount) {
    throw createCatalogUnavailableError('Catalog rounds are stale or missing. Run `npm run catalog:seed` before serving requests.');
  }

  return {
    leagueCount,
    lotteryCount,
    rateProfileCount,
    announcementCount,
    activeRoundCount
  };
};

const ensureCatalogReady = async ({ force = false } = {}) => {
  if (!catalogReadinessPromise || force) {
    catalogReadinessPromise = verifyCatalogSeeded().catch((error) => {
      catalogReadinessPromise = null;
      throw error;
    });
  }

  return catalogReadinessPromise;
};

const ensureCatalogSeed = async ({ force = false } = {}) => {
  if (!catalogSeedPromise || force) {
    catalogSeedPromise = runCatalogSeed()
      .then(() => ensureCatalogReady({ force: true }))
      .catch((error) => {
        catalogSeedPromise = null;
        throw error;
      });
  }

  return catalogSeedPromise;
};

const mapLegacyResult = (legacyResult, lotteryType) => {
  if (!legacyResult || !lotteryType) return null;
  const threeTop = legacyResult.firstPrize ? legacyResult.firstPrize.slice(-3) : '';
  const twoTop = legacyResult.firstPrize ? legacyResult.firstPrize.slice(-2) : '';
  const threeFrontHits = [...new Set((legacyResult.threeTopList || []).filter(Boolean))];
  const threeBottomHits = [...new Set((legacyResult.threeBotList || []).filter(Boolean))];
  return {
    id: `legacy-${legacyResult._id}`,
    lotteryTypeId: lotteryType._id.toString(),
    lotteryCode: lotteryType.code,
    lotteryName: lotteryType.name,
    roundCode: legacyResult.roundDate,
    headline: legacyResult.firstPrize || legacyResult.twoBottom || '-',
    firstPrize: legacyResult.firstPrize || '',
    twoTop,
    twoBottom: legacyResult.twoBottom || '',
    threeTop,
    threeFront: threeFrontHits[0] || '',
    threeBottom: threeBottomHits[0] || '',
    threeTopHits: threeTop ? [threeTop] : [],
    twoTopHits: twoTop ? [twoTop] : [],
    twoBottomHits: legacyResult.twoBottom ? [legacyResult.twoBottom] : [],
    threeFrontHits,
    threeBottomHits,
    runTop: legacyResult.runTop || [],
    runBottom: legacyResult.runBottom || [],
    resultPublishedAt: legacyResult.updatedAt || legacyResult.createdAt,
    sourceType: 'legacy',
    sourceUrl: ''
  };
};

const getResultChronologyTime = (item) => {
  const drawAt = item?.drawAt ? new Date(item.drawAt).getTime() : 0;
  if (Number.isFinite(drawAt) && drawAt > 0) {
    return drawAt;
  }

  const roundCodeMatch = String(item?.roundCode || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (roundCodeMatch) {
    return createBangkokDate(
      Number(roundCodeMatch[1]),
      Number(roundCodeMatch[2]),
      Number(roundCodeMatch[3]),
      12,
      0,
      0
    ).getTime();
  }

  const publishedAt = item?.resultPublishedAt ? new Date(item.resultPublishedAt).getTime() : 0;
  return Number.isFinite(publishedAt) ? publishedAt : 0;
};

const getRecentResults = async ({ lotteryId = null, limit = 50 } = {}) => {
  const fetchLimit = Math.max(limit * 3, limit + 20);
  const now = Date.now();
  const results = await ResultRecord.find({ isPublished: true, ...(lotteryId && { lotteryTypeId: lotteryId }) })
    .sort({ updatedAt: -1 })
    .limit(fetchLimit)
    .populate('lotteryTypeId', 'code name shortName provider')
    .populate('drawRoundId', 'code title drawAt resultPublishedAt')
    .lean();

  const mapped = results
    .filter((record) => {
      if (record.drawRoundId?.resultPublishedAt) {
        return true;
      }

      const drawAt = record.drawRoundId?.drawAt ? new Date(record.drawRoundId.drawAt).getTime() : 0;
      return !drawAt || drawAt <= now;
    })
    .map((record) => ({
    id: record._id.toString(),
    lotteryTypeId: record.lotteryTypeId?._id?.toString(),
    lotteryCode: record.lotteryTypeId?.code,
    lotteryName: record.lotteryTypeId?.name,
    lotteryShortName: record.lotteryTypeId?.shortName,
    provider: record.lotteryTypeId?.provider || '',
    roundId: record.drawRoundId?._id?.toString?.() || '',
    roundCode: record.drawRoundId?.code || '',
    roundTitle: record.drawRoundId?.title || '',
    drawAt: record.drawRoundId?.drawAt,
    resultPublishedAt: record.drawRoundId?.resultPublishedAt || record.updatedAt,
    headline: record.headline || record.firstPrize || record.twoBottom || '-',
      firstPrize: record.firstPrize || '',
      twoTop: record.twoTop || '',
      twoBottom: record.twoBottom || '',
      threeTop: record.threeTop || '',
      threeFront: record.threeFront || '',
      threeBottom: record.threeBottom || '',
      threeTopHits: record.threeTopHits || [],
      twoTopHits: record.twoTopHits || [],
      twoBottomHits: record.twoBottomHits || [],
      threeFrontHits: record.threeFrontHits || [],
      threeBottomHits: record.threeBottomHits || [],
    runTop: record.runTop || [],
    runBottom: record.runBottom || [],
    sourceType: record.sourceType,
    sourceUrl: record.sourceUrl || ''
  }));

  const externalSnapshots = await getStoredLatestExternalResults({ lotteryId, limit });
  externalSnapshots.forEach((snapshot) => {
    if (!mapped.find((item) => item.lotteryCode === snapshot.lotteryCode && item.roundCode === snapshot.roundCode)) {
      mapped.push(snapshot);
    }
  });

  mapped.sort((left, right) => {
    const leftDate = getResultChronologyTime(left);
    const rightDate = getResultChronologyTime(right);
    return rightDate - leftDate;
  });

  if (lotteryId) return mapped.slice(0, limit);

  const thaiGov = await LotteryType.findOne({ code: 'thai_government' });
  const legacyLatest = await LotteryResult.findOne().sort({ updatedAt: -1, roundDate: -1 });
  const legacyMapped = mapLegacyResult(legacyLatest, thaiGov);
  const hasOfficialThaiGov = mapped.some(
    (item) => item.lotteryCode === 'thai_government' && item.sourceType !== 'legacy'
  );

  if (
    legacyMapped
    && !hasOfficialThaiGov
    && !mapped.find((item) => item.roundCode === legacyMapped.roundCode && item.lotteryCode === legacyMapped.lotteryCode)
  ) {
    mapped.unshift(legacyMapped);
  }

  return mapped.slice(0, limit);
};

const getAnnouncementFilter = (viewer = null) => {
  if (!viewer?.role) {
    return { isActive: true };
  }

  return {
    isActive: true,
    $or: [
      { audience: { $size: 0 } },
      { audience: viewer.role }
    ]
  };
};

const getCatalogOverviewCacheKey = (viewer = null, variant = 'full', options = {}) => {
  const role = viewer?.role || 'anonymous';
  const viewerId = toIdString(viewer?._id || viewer?.id);
  const includeAnnouncements = options.includeAnnouncements !== false ? '1' : '0';
  const includeRecentResults = options.includeRecentResults !== false ? '1' : '0';
  return `${variant}:ann${includeAnnouncements}:recent${includeRecentResults}:${role}:${viewerId}`;
};

const canUseCatalogOverviewSnapshot = (viewer = null, options = {}) => {
  if (viewer?.role === 'customer') {
    return options.cacheVariant === 'betting' &&
      options.includeAnnouncements === false &&
      options.includeRecentResults === false;
  }

  return ['full', 'betting', 'lottery-page'].includes(options.cacheVariant || 'full');
};

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesCatalogOverviewSnapshotUser = (key = '', userId = '') =>
  Boolean(userId) && String(key || '').endsWith(`:${userId}`);

const clearCatalogReferenceCaches = () => {
  clearReferenceDataCache(activeLeaguesCache);
  clearReferenceDataCache(activeRoundsCache);
};

const clearCatalogOverviewCache = ({ includeSnapshots = true, includeReferences = true } = {}) => {
  catalogOverviewCache.clear();
  catalogOverviewInFlight.clear();
  if (includeReferences) {
    clearCatalogReferenceCaches();
  }

  if (includeSnapshots) {
    return CatalogOverviewSnapshot.deleteMany({}).catch((error) => {
      console.warn('Failed to clear catalog overview snapshots:', error.message);
    });
  }

  return Promise.resolve();
};

const clearCatalogOverviewCacheForUsers = ({ userIds = [] } = {}) => {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map(toIdString).filter(Boolean))];
  if (!ids.length) {
    return Promise.resolve();
  }

  for (const key of catalogOverviewCache.keys()) {
    if (ids.some((id) => matchesCatalogOverviewSnapshotUser(key, id))) {
      catalogOverviewCache.delete(key);
    }
  }

  for (const key of catalogOverviewInFlight.keys()) {
    if (ids.some((id) => matchesCatalogOverviewSnapshotUser(key, id))) {
      catalogOverviewInFlight.delete(key);
    }
  }

  return CatalogOverviewSnapshot.deleteMany({
    $or: ids.map((id) => ({ key: { $regex: `:customer:${escapeRegExp(id)}$` } }))
  }).catch((error) => {
    console.warn('Failed to clear member catalog overview snapshots:', error.message);
  });
};

const pruneCatalogOverviewCache = (now = Date.now()) => {
  for (const [key, cached] of catalogOverviewCache.entries()) {
    if (now - cached.cachedAt >= CATALOG_OVERVIEW_CACHE_MS) {
      catalogOverviewCache.delete(key);
    }
  }

  while (catalogOverviewCache.size > CATALOG_OVERVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = catalogOverviewCache.keys().next().value;
    catalogOverviewCache.delete(oldestKey);
  }
};

const createCatalogOverviewSnapshotDocument = (key, overview) => ({
  key,
  payload: overview || {},
  builtAt: new Date(),
  version: 1
});

const restoreCatalogOverviewFromSnapshotDocument = (document) => {
  const payload = document?.payload;
  if (!payload || !Array.isArray(payload.leagues)) {
    return null;
  }

  return payload;
};

const getSnapshotAgeMs = (builtAt, now = Date.now()) => {
  const builtAtMs = new Date(builtAt || 0).getTime();
  return Number.isFinite(builtAtMs) ? now - builtAtMs : Infinity;
};

const isCatalogOverviewSnapshotFresh = (builtAt, now = Date.now()) => {
  if (!builtAt) {
    return false;
  }

  return CATALOG_OVERVIEW_SNAPSHOT_TTL_MS <= 0 ||
    getSnapshotAgeMs(builtAt, now) < CATALOG_OVERVIEW_SNAPSHOT_TTL_MS;
};

const isCatalogOverviewSnapshotUsable = (builtAt, now = Date.now()) => {
  if (!builtAt) {
    return false;
  }

  return isCatalogOverviewSnapshotFresh(builtAt, now) ||
    (CATALOG_OVERVIEW_STALE_MAX_MS > 0 && getSnapshotAgeMs(builtAt, now) < CATALOG_OVERVIEW_STALE_MAX_MS);
};

const scheduleCatalogOverviewSnapshotRefresh = (reason) => {
  try {
    const { scheduleReadModelSnapshotRebuild } = require('./readModelSnapshotService');
    scheduleReadModelSnapshotRebuild({
      reason,
      targets: ['catalog']
    });
  } catch (error) {
    console.warn('Failed to schedule catalog snapshot refresh:', error.message);
  }
};

const loadCatalogOverviewSnapshotState = async (key, now = Date.now(), { allowStale = false } = {}) => {
  const document = await CatalogOverviewSnapshot.findOne({ key }).lean();
  if (!document?.builtAt) {
    return null;
  }

  const data = restoreCatalogOverviewFromSnapshotDocument(document);
  if (!data) {
    return null;
  }

  const isFresh = isCatalogOverviewSnapshotFresh(document.builtAt, now);
  if (!isFresh && (!allowStale || !isCatalogOverviewSnapshotUsable(document.builtAt, now))) {
    return null;
  }

  return {
    data,
    builtAt: document.builtAt,
    isFresh
  };
};

const loadCatalogOverviewSnapshot = async (key, now = Date.now()) => {
  const snapshot = await loadCatalogOverviewSnapshotState(key, now);
  return snapshot?.data || null;
};

const saveCatalogOverviewSnapshot = async (key, overview) => {
  const snapshotDocument = createCatalogOverviewSnapshotDocument(key, overview);
  await CatalogOverviewSnapshot.findOneAndUpdate(
    { key },
    snapshotDocument,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
};

const buildCatalogOverview = async (viewer = null, options = {}) => {
  const {
    includeAnnouncements = true,
    includeRecentResults = true
  } = options;

  await ensureCatalogReady();

  const [leagues, lotteries, rounds, announcements, recentResults] = await Promise.all([
    loadActiveLeagues(),
    loadActiveLotteries(),
    loadCatalogActiveRounds(),
    includeAnnouncements
      ? Announcement.find(getAnnouncementFilter(viewer)).sort({ publishedAt: -1 }).limit(5).lean()
      : Promise.resolve([]),
    includeRecentResults
      ? getRecentResults({ limit: 50 })
      : Promise.resolve([])
  ]);

  let memberConfigMap = null;
  if (viewer?.role === 'customer') {
    const memberConfigRows = await getMemberConfigRows({ member: viewer, lotteries, ensureMissing: false });
    memberConfigMap = memberConfigRows.reduce((acc, row) => {
      acc[row.lotteryTypeId] = row;
      return acc;
    }, {});
  }

  const roundsByLottery = rounds.reduce((acc, round) => {
    const key = round.lotteryTypeId.toString();
    acc[key] = acc[key] || [];
    acc[key].push(round);
    return acc;
  }, {});
  const now = new Date();

  const resultsByLottery = recentResults.reduce((acc, result) => {
    if (!result.lotteryTypeId) return acc;

    const current = acc[result.lotteryTypeId];
    if (!current || getResultChronologyTime(result) > getResultChronologyTime(current)) {
      acc[result.lotteryTypeId] = result;
    }

    return acc;
  }, {});
  const announcementReads = viewer?._id && announcements.length
    ? await AnnouncementRead.find({
      userId: viewer._id,
      announcementId: { $in: announcements.map((item) => item._id) }
    }).select('announcementId readAt').lean()
    : [];
  const announcementReadMap = announcementReads.reduce((acc, item) => {
    acc[toIdString(item.announcementId)] = item.readAt;
    return acc;
  }, {});

  const lotteryCards = lotteries.map((lottery) => {
    const memberConfig = memberConfigMap?.[lottery._id.toString()] || null;
    if (viewer?.role === 'customer' && !memberConfig?.isEnabled) {
      return null;
    }

    const visibleRateProfiles = (lottery.rateProfileIds || [])
      .filter((profile) => profile.isActive)
      .filter((profile) => !memberConfig?.rateProfileId || profile._id.toString() === memberConfig.rateProfileId);
    const selectedRateProfile = visibleRateProfiles[0] || null;
    const effectiveRates = memberConfig?.useCustomRates
      ? normalizeRateMap(memberConfig.customRates)
      : normalizeRateMap(selectedRateProfile?.rates);
    const supportedBetTypes = memberConfig?.enabledBetTypes?.length
      ? normalizeEnabledBetTypes(memberConfig.enabledBetTypes, lottery.supportedBetTypes)
      : lottery.supportedBetTypes;
    const lotteryRounds = roundsByLottery[lottery._id.toString()] || [];
    const activeRound =
      lotteryRounds.find((round) => now <= round.closeAt) ||
      lotteryRounds.find((round) => now <= round.drawAt) ||
      lotteryRounds[0] ||
      null;
    const statusMeta = getRoundStatus(activeRound, now);
    const latestResult = resultsByLottery[lottery._id.toString()] || null;

    return {
      id: lottery._id.toString(),
      code: lottery.code,
      name: lottery.name,
      shortName: lottery.shortName,
      description: lottery.description,
      provider: lottery.provider,
      leagueId: lottery.leagueId?._id?.toString() || lottery.leagueId?.toString(),
      leagueCode: lottery.leagueId?.code || '',
      leagueName: lottery.leagueId?.name || '',
      supportedBetTypes,
      status: statusMeta.status,
      statusLabel: statusMeta.label,
      countdownSeconds: statusMeta.countdownSeconds,
      activeRound: activeRound ? {
        id: activeRound._id.toString(),
        code: activeRound.code,
        title: activeRound.title,
        openAt: activeRound.openAt,
        closeAt: activeRound.closeAt,
        drawAt: activeRound.drawAt,
        isManualTiming: Boolean(activeRound.isManualTiming),
        timingUpdatedAt: activeRound.timingUpdatedAt || null,
        status: statusMeta.status,
        statusLabel: statusMeta.label,
        countdownSeconds: statusMeta.countdownSeconds,
        bettingOverride: statusMeta.bettingOverride,
        isManualOverride: statusMeta.isManualOverride,
        closedBetTypes: activeRound.closedBetTypes || [],
        displayDate: formatBangkokDate(activeRound.drawAt),
        displayOpenAt: formatBangkokDateTime(activeRound.openAt),
        displayDrawAt: formatBangkokDateTime(activeRound.drawAt),
        displayCloseAt: formatBangkokDateTime(activeRound.closeAt)
      } : null,
      rateProfiles: selectedRateProfile ? [{
        id: selectedRateProfile._id.toString(),
        code: memberConfig?.useCustomRates ? `${selectedRateProfile.code}_custom` : selectedRateProfile.code,
        name: memberConfig?.useCustomRates ? `${selectedRateProfile.name} (Custom)` : selectedRateProfile.name,
        description: selectedRateProfile.description,
        isDefault: true,
        rates: effectiveRates
      }] : [],
      defaultRateProfileId: memberConfig?.rateProfileId || lottery.defaultRateProfileId?._id?.toString() || null,
      memberLimits: memberConfig ? {
        minimumBet: memberConfig.minimumBet,
        maximumBet: memberConfig.maximumBet,
        maximumPerNumber: memberConfig.maximumPerNumber,
        keepMode: memberConfig.keepMode,
        keepCapAmount: memberConfig.keepCapAmount,
        blockedNumbers: memberConfig.blockedNumbers || []
      } : null,
      latestResult
    };
  }).filter(Boolean);

  const leaguesPayload = leagues.map((league) => ({
    id: league._id.toString(),
    code: league.code,
    name: league.name,
    description: league.description,
    lotteries: lotteryCards.filter((lottery) => lottery.leagueCode === league.code)
  })).filter((league) => league.lotteries.length > 0);

  const firstLottery = lotteryCards[0] || null;
  const selectionDefaults = {
    leagueId: firstLottery?.leagueId || null,
    lotteryId: firstLottery?.id || null,
    roundId: firstLottery?.activeRound?.id || null,
    rateProfileId: firstLottery?.defaultRateProfileId || firstLottery?.rateProfiles?.[0]?.id || null
  };

  return {
    generatedAt: new Date().toISOString(),
    selectionDefaults,
    announcements: announcements.map((item) => ({
      id: item._id.toString(),
      code: item.code,
      title: item.title,
      body: item.body,
      audience: item.audience,
      publishedAt: item.publishedAt,
      isRead: Boolean(announcementReadMap[item._id.toString()]),
      readAt: announcementReadMap[item._id.toString()] || null
    })),
    leagues: leaguesPayload,
    recentResults
  };
};

const getCachedCatalogOverview = async (viewer = null, options = {}) => {
  const { cacheVariant = 'full', force = false, ...buildOptions } = options;
  const cacheKey = getCatalogOverviewCacheKey(viewer, cacheVariant, buildOptions);
  const now = Date.now();
  const shouldUseSnapshot = canUseCatalogOverviewSnapshot(viewer, { cacheVariant, ...buildOptions });
  pruneCatalogOverviewCache(now);
  const cached = catalogOverviewCache.get(cacheKey);

  if (!force && cached && now - cached.cachedAt < CATALOG_OVERVIEW_CACHE_MS) {
    return cached.data;
  }

  const allowStaleSnapshot = viewer?.role !== 'customer';

  if (
    !force &&
    shouldUseSnapshot &&
    allowStaleSnapshot &&
    cached?.data &&
    isCatalogOverviewSnapshotUsable(cached.builtAt || cached.cachedAt, now)
  ) {
    scheduleCatalogOverviewSnapshotRefresh('catalog-stale-memory-read');
    return cached.data;
  }

  if (!force && shouldUseSnapshot) {
    const snapshot = await loadCatalogOverviewSnapshotState(cacheKey, now, { allowStale: allowStaleSnapshot });
    if (snapshot) {
      catalogOverviewCache.set(cacheKey, {
        cachedAt: Date.now(),
        builtAt: snapshot.builtAt,
        data: snapshot.data
      });
      pruneCatalogOverviewCache();
      if (!snapshot.isFresh) {
        scheduleCatalogOverviewSnapshotRefresh('catalog-stale-persistent-read');
      }
      return snapshot.data;
    }
  }

  if (!force && catalogOverviewInFlight.has(cacheKey)) {
    return catalogOverviewInFlight.get(cacheKey);
  }

  const request = buildCatalogOverview(viewer, buildOptions)
    .then(async (data) => {
      catalogOverviewCache.set(cacheKey, {
        cachedAt: Date.now(),
        builtAt: new Date(),
        data
      });
      pruneCatalogOverviewCache();
      catalogOverviewInFlight.delete(cacheKey);

      if (shouldUseSnapshot) {
        await saveCatalogOverviewSnapshot(cacheKey, data).catch((error) => {
          console.warn('Failed to save catalog overview snapshot:', error.message);
        });
      }

      return data;
    })
    .catch((error) => {
      catalogOverviewInFlight.delete(cacheKey);
      throw error;
    });

  catalogOverviewInFlight.set(cacheKey, request);
  return request;
};

const getCatalogOverview = async (viewer = null, options = {}) => getCachedCatalogOverview(viewer, {
  cacheVariant: options.cacheVariant || 'full',
  includeAnnouncements: options.includeAnnouncements !== false,
  includeRecentResults: options.includeRecentResults !== false,
  force: Boolean(options.force)
});

const rebuildCatalogOverviewSnapshot = async (viewer = null, options = {}) => {
  const normalizedOptions = {
    cacheVariant: options.cacheVariant || 'full',
    includeAnnouncements: options.includeAnnouncements !== false,
    includeRecentResults: options.includeRecentResults !== false
  };
  const cacheKey = getCatalogOverviewCacheKey(viewer, normalizedOptions.cacheVariant, normalizedOptions);
  const overview = await buildCatalogOverview(viewer, {
    includeAnnouncements: normalizedOptions.includeAnnouncements,
    includeRecentResults: normalizedOptions.includeRecentResults
  });

  catalogOverviewCache.set(cacheKey, {
    cachedAt: Date.now(),
    builtAt: new Date(),
    data: overview
  });
  await saveCatalogOverviewSnapshot(cacheKey, overview);
  return overview;
};

const rebuildOperatorCatalogOverviewSnapshots = async ({ limit = 50 } = {}) => {
  const operators = await User.find({
    role: { $in: ['admin', 'agent'] },
    isActive: { $ne: false }
  })
    .select('_id role')
    .sort({ role: 1, createdAt: 1 })
    .limit(Math.max(1, Number(limit) || 50))
    .lean();

  const summary = {
    attempted: operators.length,
    rebuilt: 0,
    failed: 0,
    errors: []
  };

  const variants = [
    { cacheVariant: 'full', includeAnnouncements: true, includeRecentResults: true },
    { cacheVariant: 'betting', includeAnnouncements: false, includeRecentResults: false },
    { cacheVariant: 'lottery-page', includeAnnouncements: false, includeRecentResults: false }
  ];

  for (const operator of operators) {
    for (const variantOptions of variants) {
      try {
        await rebuildCatalogOverviewSnapshot(operator, variantOptions);
        summary.rebuilt += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          userId: toIdString(operator._id),
          role: operator.role,
          variant: variantOptions.cacheVariant,
          message: error.message
        });
      }
    }
  }

  return summary;
};

const getBettingCatalogOverview = async (viewer = null) => getCachedCatalogOverview(viewer, {
  cacheVariant: 'betting',
  includeAnnouncements: false,
  includeRecentResults: false
});

const markAnnouncementRead = async ({ viewer, announcementId }) => {
  await ensureCatalogReady();

  const announcement = await Announcement.findOne({
    _id: announcementId,
    ...getAnnouncementFilter(viewer)
  });

  if (!announcement) {
    throw new Error('Announcement not found');
  }

  await AnnouncementRead.updateOne(
    {
      announcementId,
      userId: viewer._id
    },
    {
      $set: {
        readAt: new Date()
      }
    },
    { upsert: true }
  );
  clearCatalogOverviewCache();

  return {
    id: announcement._id.toString(),
    isRead: true
  };
};

const getLotteryOptions = async (viewer = null) => {
  const overview = await getCatalogOverview(viewer);
  return (overview.leagues || []).flatMap((league) =>
    (league.lotteries || []).map((lottery) => ({
      id: lottery.id,
      name: lottery.name,
      code: lottery.code,
      leagueId: league.id,
      leagueName: league.name,
      supportedBetTypes: lottery.supportedBetTypes || [],
      roundId: lottery.activeRound?.id || null,
      roundTitle: lottery.activeRound?.title || null,
      defaultRateProfileId: lottery.defaultRateProfileId
    }))
  );
};

const getRoundsByLottery = async (lotteryId, viewer = null) => {
  await ensureCatalogReady();

  if (viewer?.role === 'customer') {
    const lotteries = await LotteryType.find({ _id: lotteryId, isActive: true })
      .populate('leagueId', 'code name')
      .populate('rateProfileIds', 'code name description isActive rates')
      .populate('defaultRateProfileId', 'code name description isActive rates');

    if (!lotteries.length) {
      return [];
    }

    const memberConfigRows = await getMemberConfigRows({ member: viewer, lotteries });
    if (!memberConfigRows[0]?.isEnabled) {
      return [];
    }
  }

  const rounds = await DrawRound.find({ lotteryTypeId: lotteryId, isActive: true }).sort({ drawAt: 1 }).limit(20);
  return rounds.map((round) => {
    const statusMeta = getRoundStatus(round);

    return {
      id: round._id.toString(),
      code: round.code,
      title: round.title,
      openAt: round.openAt,
      closeAt: round.closeAt,
      drawAt: round.drawAt,
      isManualTiming: Boolean(round.isManualTiming),
      timingUpdatedAt: round.timingUpdatedAt || null,
      bettingOverride: statusMeta.bettingOverride,
      isManualOverride: statusMeta.isManualOverride,
      closedBetTypes: round.closedBetTypes || [],
      displayDate: formatBangkokDate(round.drawAt),
      displayOpenAt: formatBangkokDateTime(round.openAt),
      displayCloseAt: formatBangkokDateTime(round.closeAt),
      ...statusMeta
    };
  });
};

module.exports = {
  buildRoundUpsertOperations,
  ensureCatalogSeed,
  ensureCatalogReady,
  clearCatalogOverviewCache,
  clearCatalogReferenceCaches,
  clearCatalogOverviewCacheForUsers,
  getCatalogOverview,
  rebuildCatalogOverviewSnapshot,
  rebuildOperatorCatalogOverviewSnapshots,
  getBettingCatalogOverview,
  getLotteryOptions,
  getRoundsByLottery,
  getRecentResults,
  getRoundStatus,
  normalizeRoundTimingPayload,
  markAnnouncementRead,
  __test: {
    canUseCatalogOverviewSnapshot,
    createCatalogOverviewSnapshotDocument,
    restoreCatalogOverviewFromSnapshotDocument,
    isCatalogOverviewSnapshotFresh,
    isCatalogOverviewSnapshotUsable
  }
};

