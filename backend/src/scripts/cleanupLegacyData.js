require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const LotteryLeague = require('../models/LotteryLeague');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const User = require('../models/User');
const { ensureRoundForLottery } = require('../services/resultService');
const { normalizeLotteryCode } = require('../utils/lotteryCode');

const ALL_BET_TYPES = ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];
const SECTION_TO_LEAGUE_CODE = {
  government: 'government',
  international: 'foreign',
  stocks: 'stocks',
  vip: 'vip'
};
const WRITE_MODES = new Set(['migrate', 'archive', 'purge']);

const parseArgs = () => {
  const options = {
    mode: 'dry-run',
    yes: false,
    archiveName: ''
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
      return;
    }

    if (arg === '--yes') {
      options.yes = true;
      return;
    }

    if (arg.startsWith('--archive-name=')) {
      options.archiveName = arg.split('=')[1];
    }
  });

  return options;
};

const formatBatchId = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
};

const collectionExists = async (db, name) => {
  const collections = await db.listCollections({ name }).toArray();
  return collections.length > 0;
};

const isShadowBetDocument = (doc) =>
  Boolean(doc.slipId) || Boolean(doc.betItemId) || doc.sourceType === 'member-slip';

const resolveLegacyLeagueCode = (sectionId) =>
  SECTION_TO_LEAGUE_CODE[String(sectionId || '').trim()] || 'daily';

const truncateName = (value, max = 20) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.length > max ? normalized.slice(0, max) : normalized;
};

const buildLegacySlipNumber = (legacyBetId) =>
  `LGC-${String(legacyBetId).slice(-8).toUpperCase()}`;

const matchRateProfile = (profiles, betType, payRate) =>
  profiles.find((profile) => Number(profile.rates?.[betType] || 0) === Number(payRate || 0)) || null;

const getOrCreateLegacyLotteryType = async ({
  legacyBet,
  lotteryCache,
  rateProfiles,
  fallbackLeague
}) => {
  const lotteryCode = normalizeLotteryCode(legacyBet.marketId || legacyBet.marketName || 'legacy-market');
  if (lotteryCache.has(lotteryCode)) {
    return lotteryCache.get(lotteryCode);
  }

  let lotteryType = await LotteryType.findOne({ code: lotteryCode });
  if (!lotteryType) {
    const leagueCode = resolveLegacyLeagueCode(legacyBet.marketSectionId);
    const league =
      (await LotteryLeague.findOne({ code: leagueCode })) ||
      fallbackLeague;

    const defaultRateProfile = rateProfiles.find((profile) => profile.isDefault) || rateProfiles[0] || null;

    lotteryType = await LotteryType.create({
      code: lotteryCode,
      leagueId: league._id,
      name: legacyBet.marketName || lotteryCode,
      shortName: truncateName(legacyBet.marketName || lotteryCode, 16),
      description: 'Migrated from legacy bets collection',
      provider: 'Legacy Import',
      supportedBetTypes: ALL_BET_TYPES,
      rateProfileIds: rateProfiles.map((profile) => profile._id),
      defaultRateProfileId: defaultRateProfile?._id || null,
      resultSource: 'manual',
      schedule: {
        type: 'daily',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        openLeadDays: 1,
        closeHour: 23,
        closeMinute: 0,
        drawHour: 23,
        drawMinute: 30
      },
      sortOrder: 999,
      isActive: false
    });
  }

  lotteryCache.set(lotteryCode, lotteryType);
  return lotteryType;
};

const ensureLegacyRound = async ({ lotteryType, roundCode, roundCache }) => {
  const cacheKey = `${lotteryType._id.toString()}:${roundCode}`;
  if (roundCache.has(cacheKey)) {
    return roundCache.get(cacheKey);
  }

  const round = await ensureRoundForLottery(lotteryType, roundCode);
  if (!round) {
    throw new Error(`Unable to create round for ${roundCode}`);
  }

  roundCache.set(cacheKey, round);
  return round;
};

const setDocumentTimestamps = async (collection, id, source) => {
  const createdAt = source.createdAt || new Date();
  const updatedAt = source.updatedAt || createdAt;

  await collection.updateOne(
    { _id: id },
    {
      $set: {
        createdAt,
        updatedAt
      }
    }
  );
};

const archiveLegacyCollection = async ({ db, sourceName, targetName, batchId, mode }) => {
  const source = db.collection(sourceName);
  const target = db.collection(targetName);
  const cursor = source.find({}).sort({ _id: 1 });

  let archivedCount = 0;
  let batch = [];

  for await (const doc of cursor) {
    batch.push({
      ...doc,
      _cleanupBatchId: batchId,
      _cleanupMode: mode,
      _archivedAt: new Date(),
      _archivedFrom: sourceName
    });

    if (batch.length >= 500) {
      await target.insertMany(batch, { ordered: false });
      archivedCount += batch.length;
      batch = [];
    }
  }

  if (batch.length) {
    await target.insertMany(batch, { ordered: false });
    archivedCount += batch.length;
  }

  return archivedCount;
};

const loadExistingMigrationIds = async () => {
  const items = await BetItem.find({ migrationSourceType: 'legacy-bet' })
    .select('migrationSourceId')
    .lean();

  return new Set(
    items
      .map((item) => item.migrationSourceId)
      .filter(Boolean)
      .map((id) => id.toString())
  );
};

const analyzeLegacyBets = async ({ db, migratedIds }) => {
  if (!(await collectionExists(db, 'bets'))) {
    return {
      totalLegacyBets: 0,
      shadowBetCount: 0,
      migratedStandaloneCount: migratedIds.size,
      pendingStandaloneCount: 0,
      staleLegacyFieldCount: await db.collection('betitems').countDocuments({ legacyBetId: { $exists: true } })
    };
  }

  const cursor = db.collection('bets').find({}, { projection: { _id: 1, slipId: 1, betItemId: 1, sourceType: 1 } });

  const summary = {
    totalLegacyBets: 0,
    shadowBetCount: 0,
    migratedStandaloneCount: 0,
    pendingStandaloneCount: 0,
    staleLegacyFieldCount: await db.collection('betitems').countDocuments({ legacyBetId: { $exists: true } })
  };

  for await (const doc of cursor) {
    summary.totalLegacyBets += 1;

    if (isShadowBetDocument(doc)) {
      summary.shadowBetCount += 1;
      continue;
    }

    if (migratedIds.has(doc._id.toString())) {
      summary.migratedStandaloneCount += 1;
      continue;
    }

    summary.pendingStandaloneCount += 1;
  }

  return summary;
};

const migrateLegacyBets = async ({ db, batchId }) => {
  if (!(await collectionExists(db, 'bets'))) {
    return {
      migratedCount: 0,
      skippedShadowCount: 0,
      skippedAlreadyMigratedCount: 0,
      failedCount: 0,
      failures: []
    };
  }

  const migratedIds = await loadExistingMigrationIds();
  const rateProfiles = await RateProfile.find().sort({ isDefault: -1, createdAt: 1 });
  const fallbackLeague =
    (await LotteryLeague.findOne({ code: 'daily' })) ||
    (await LotteryLeague.findOne().sort({ sortOrder: 1, createdAt: 1 }));

  const lotteryCache = new Map();
  const roundCache = new Map();
  const cursor = db.collection('bets').find({}).sort({ _id: 1 });
  const result = {
    migratedCount: 0,
    skippedShadowCount: 0,
    skippedAlreadyMigratedCount: 0,
    failedCount: 0,
    failures: []
  };

  for await (const legacyBet of cursor) {
    if (isShadowBetDocument(legacyBet)) {
      result.skippedShadowCount += 1;
      continue;
    }

    if (migratedIds.has(legacyBet._id.toString())) {
      result.skippedAlreadyMigratedCount += 1;
      continue;
    }

    try {
      const customer = await User.findById(legacyBet.customerId).select('_id agentId');
      if (!customer) {
        throw new Error('Customer not found');
      }

      const agentId = legacyBet.agentId || customer.agentId;
      if (!agentId) {
        throw new Error('Agent not found for legacy bet');
      }

      const lotteryType = await getOrCreateLegacyLotteryType({
        legacyBet,
        lotteryCache,
        rateProfiles,
        fallbackLeague
      });
      const round = await ensureLegacyRound({
        lotteryType,
        roundCode: legacyBet.roundDate,
        roundCache
      });
      const rateProfile = matchRateProfile(rateProfiles, legacyBet.betType, legacyBet.payRate);

      const slip = await BetSlip.create({
        customerId: customer._id,
        agentId,
        lotteryTypeId: lotteryType._id,
        drawRoundId: round._id,
        rateProfileId: rateProfile?._id || null,
        slipNumber: buildLegacySlipNumber(legacyBet._id),
        lotteryCode: lotteryType.code,
        lotteryName: lotteryType.name,
        roundCode: round.code,
        roundTitle: round.title,
        rateProfileName: rateProfile?.name || 'Legacy Imported',
        openAt: round.openAt,
        closeAt: round.closeAt,
        drawAt: round.drawAt,
        sourceType: 'legacy-import',
        status: 'submitted',
        memo: `Migrated from legacy bet ${legacyBet._id}`,
        itemCount: 1,
        totalAmount: legacyBet.amount,
        potentialPayout: Number(legacyBet.amount || 0) * Number(legacyBet.payRate || 0),
        submittedAt: legacyBet.createdAt || new Date()
      });

      const item = await BetItem.create({
        slipId: slip._id,
        customerId: customer._id,
        agentId,
        lotteryTypeId: lotteryType._id,
        drawRoundId: round._id,
        rateProfileId: rateProfile?._id || null,
        migrationSourceType: 'legacy-bet',
        migrationSourceId: legacyBet._id,
        sequence: 1,
        betType: legacyBet.betType,
        number: legacyBet.number,
        amount: legacyBet.amount,
        payRate: legacyBet.payRate,
        potentialPayout: Number(legacyBet.amount || 0) * Number(legacyBet.payRate || 0),
        status: 'submitted',
        result: legacyBet.result || 'pending',
        wonAmount: legacyBet.wonAmount || 0,
        isLocked: Boolean(legacyBet.isLocked)
      });

      await setDocumentTimestamps(BetSlip.collection, slip._id, legacyBet);
      await setDocumentTimestamps(BetItem.collection, item._id, legacyBet);

      migratedIds.add(legacyBet._id.toString());
      result.migratedCount += 1;
    } catch (error) {
      result.failedCount += 1;
      result.failures.push({
        legacyBetId: legacyBet._id.toString(),
        message: error.message
      });
    }
  }

  return {
    ...result,
    batchId
  };
};

const cleanupLegacyReferences = async (db) => {
  const cleanup = await db.collection('betitems').updateMany(
    { legacyBetId: { $exists: true } },
    { $unset: { legacyBetId: '' } }
  );

  return {
    matchedCount: cleanup.matchedCount || 0,
    modifiedCount: cleanup.modifiedCount || 0
  };
};

const main = async () => {
  const options = parseArgs();
  if (!['dry-run', 'migrate', 'archive', 'purge'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  if (WRITE_MODES.has(options.mode) && !options.yes) {
    throw new Error('Write modes require --yes');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const batchId = formatBatchId();
  const initialMigratedIds = await loadExistingMigrationIds();
  const before = await analyzeLegacyBets({ db, migratedIds: initialMigratedIds });

  const output = {
    mode: options.mode,
    batchId,
    before,
    migration: null,
    cleanup: null,
    archive: null
  };

  if (options.mode !== 'dry-run') {
    output.migration = await migrateLegacyBets({ db, batchId });
    output.cleanup = await cleanupLegacyReferences(db);

    if (output.migration.failedCount > 0 && options.mode !== 'migrate') {
      throw new Error('Migration reported failures. Archive/purge aborted.');
    }

    if (options.mode === 'archive' || options.mode === 'purge') {
      const betsExists = await collectionExists(db, 'bets');
      if (betsExists) {
        if (options.mode === 'archive') {
          const archiveName = options.archiveName || `bets_legacy_archive_${batchId}`;
          if (await collectionExists(db, archiveName)) {
            throw new Error(`Archive collection already exists: ${archiveName}`);
          }

          const archivedCount = await archiveLegacyCollection({
            db,
            sourceName: 'bets',
            targetName: archiveName,
            batchId,
            mode: options.mode
          });

          output.archive = {
            collection: archiveName,
            archivedCount
          };
        }

        await db.collection('bets').drop();
      }
    }
  }

  const afterMigratedIds = await loadExistingMigrationIds();
  output.after = await analyzeLegacyBets({ db, migratedIds: afterMigratedIds });

  console.log(JSON.stringify(output, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message || error);
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
