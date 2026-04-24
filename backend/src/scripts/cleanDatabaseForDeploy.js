require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const BettingDraftSession = require('../models/BettingDraftSession');
const CatalogOverviewSnapshot = require('../models/CatalogOverviewSnapshot');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DashboardSnapshot = require('../models/DashboardSnapshot');
require('../models/DrawRound');
const MarketOverviewSnapshot = require('../models/MarketOverviewSnapshot');
const ResultRecord = require('../models/ResultRecord');
const User = require('../models/User');
const UserLotteryConfig = require('../models/UserLotteryConfig');
const { buildDirectMongoUri } = require('../utils/mongoUri');

const DEFAULT_KEEP_USERNAMES = ['admin', 'agent'];
const DEFAULT_RESULT_KEEP_COUNT = 6;

const parseArgs = () => {
  const options = {
    dryRun: true,
    keepUsernames: DEFAULT_KEEP_USERNAMES,
    resultKeepCount: DEFAULT_RESULT_KEEP_COUNT
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg === '--yes') {
      options.dryRun = false;
      return;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      return;
    }

    if (arg.startsWith('--keep-users=')) {
      options.keepUsernames = arg
        .split('=')[1]
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      return;
    }

    if (arg.startsWith('--result-keep=')) {
      options.resultKeepCount = Math.max(0, Number(arg.split('=')[1] || DEFAULT_RESULT_KEEP_COUNT));
    }
  });

  return options;
};

const idString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const sortResultRecords = (left, right) => {
  const leftTime = new Date(left.drawRoundId?.drawAt || left.updatedAt || left.createdAt || 0).getTime();
  const rightTime = new Date(right.drawRoundId?.drawAt || right.updatedAt || right.createdAt || 0).getTime();
  if (leftTime !== rightTime) return rightTime - leftTime;

  const codeDiff = String(right.drawRoundId?.code || '').localeCompare(String(left.drawRoundId?.code || ''));
  if (codeDiff !== 0) return codeDiff;

  return idString(right._id).localeCompare(idString(left._id));
};

const resolveResultRecordsToDelete = async (keepCount) => {
  const records = await ResultRecord.find({})
    .select('_id lotteryTypeId drawRoundId updatedAt createdAt')
    .populate('drawRoundId', 'code drawAt')
    .lean();

  const byLottery = new Map();
  records.forEach((record) => {
    const key = idString(record.lotteryTypeId) || 'missing-lottery';
    byLottery.set(key, [...(byLottery.get(key) || []), record]);
  });

  const keepIds = [];
  const deleteIds = [];

  byLottery.forEach((items) => {
    const sorted = [...items].sort(sortResultRecords);
    sorted.slice(0, keepCount).forEach((record) => keepIds.push(record._id));
    sorted.slice(keepCount).forEach((record) => deleteIds.push(record._id));
  });

  return {
    marketCount: byLottery.size,
    keepCount: keepIds.length,
    deleteIds
  };
};

const countDocuments = async (queryPlan) => {
  const counts = {};
  for (const [name, task] of Object.entries(queryPlan)) {
    counts[name] = await task.model.countDocuments(task.query || {});
  }
  return counts;
};

const deleteDocuments = async (queryPlan) => {
  const deleted = {};
  for (const [name, task] of Object.entries(queryPlan)) {
    const result = await task.model.deleteMany(task.query || {});
    deleted[name] = result.deletedCount || 0;
  }
  return deleted;
};

const main = async () => {
  const options = parseArgs();
  const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
  await mongoose.connect(mongoUri);

  const keepUsers = await User.find({
    username: { $in: options.keepUsernames },
    role: { $in: ['admin', 'agent'] }
  })
    .select('_id username role name')
    .lean();

  const foundKeepUsernames = new Set(keepUsers.map((user) => user.username));
  const missingKeepUsernames = options.keepUsernames.filter((username) => !foundKeepUsernames.has(username));
  if (missingKeepUsernames.length) {
    throw new Error(`Missing protected users: ${missingKeepUsernames.join(', ')}`);
  }

  const keepUserIds = keepUsers.map((user) => user._id);
  const usersToDelete = await User.find({ _id: { $nin: keepUserIds } })
    .select('_id username role name')
    .lean();
  const userIdsToDelete = usersToDelete.map((user) => user._id);
  const resultPlan = await resolveResultRecordsToDelete(options.resultKeepCount);

  const deletedUserQuery = userIdsToDelete.length
    ? {
        $or: [
          { userId: { $in: userIdsToDelete } },
          { agentId: { $in: userIdsToDelete } },
          { actorUserId: { $in: userIdsToDelete } },
          { customerId: { $in: userIdsToDelete } },
          { counterpartyUserId: { $in: userIdsToDelete } },
          { performedByUserId: { $in: userIdsToDelete } }
        ]
      }
    : { _id: { $exists: false } };

  const queryPlan = {
    betslips: { model: BetSlip, query: {} },
    betitems: { model: BetItem, query: {} },
    resultrecords: { model: ResultRecord, query: resultPlan.deleteIds.length ? { _id: { $in: resultPlan.deleteIds } } : { _id: { $exists: false } } },
    users: { model: User, query: userIdsToDelete.length ? { _id: { $in: userIdsToDelete } } : { _id: { $exists: false } } },
    userlotteryconfigs: { model: UserLotteryConfig, query: deletedUserQuery },
    bettingdraftsessions: { model: BettingDraftSession, query: deletedUserQuery },
    creditledgerentries: { model: CreditLedgerEntry, query: {} },
    catalogoverviewsnapshots: { model: CatalogOverviewSnapshot, query: {} },
    marketoverviewsnapshots: { model: MarketOverviewSnapshot, query: {} },
    dashboardsnapshots: { model: DashboardSnapshot, query: {} }
  };

  const beforeDeleteCounts = await countDocuments(queryPlan);
  const deleted = options.dryRun ? {} : await deleteDocuments(queryPlan);

  const after = {
    users: await User.countDocuments({}),
    userRoles: await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    betslips: await BetSlip.countDocuments({}),
    betitems: await BetItem.countDocuments({}),
    resultrecords: await ResultRecord.countDocuments({}),
    maxResultRecordsPerLottery: await ResultRecord.aggregate([
      { $group: { _id: '$lotteryTypeId', count: { $sum: 1 } } },
      { $group: { _id: null, max: { $max: '$count' }, markets: { $sum: 1 } } }
    ])
  };

  console.log(JSON.stringify({
    ok: true,
    dryRun: options.dryRun,
    keepUsernames: options.keepUsernames,
    protectedUsers: keepUsers,
    usersToDelete: usersToDelete.map((user) => ({
      id: idString(user._id),
      username: user.username,
      role: user.role,
      name: user.name
    })),
    resultRetention: {
      keepPerLottery: options.resultKeepCount,
      markets: resultPlan.marketCount,
      recordsToKeep: resultPlan.keepCount,
      recordsToDelete: resultPlan.deleteIds.length
    },
    matchedForDeletion: beforeDeleteCounts,
    deleted,
    after
  }, null, 2));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message || error);
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
