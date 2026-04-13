require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const mongoose = require('mongoose');
const { backupDir, getEnvSummary, validateEnv } = require('../config/env');
const { buildDirectMongoUri } = require('../utils/mongoUri');
const User = require('../models/User');
const BetSlip = require('../models/BetSlip');
const BetItem = require('../models/BetItem');
const ResultRecord = require('../models/ResultRecord');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const LotteryLeague = require('../models/LotteryLeague');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');

const parseArgs = () => ({
  strict: process.argv.includes('--strict')
});

const main = async () => {
  const options = parseArgs();
  const report = {
    startedAt: new Date().toISOString(),
    env: getEnvSummary(),
    checks: {},
    warnings: [],
    errors: []
  };

  try {
    validateEnv();
    report.checks.env = 'ok';
  } catch (error) {
    report.checks.env = 'failed';
    report.errors.push(...(error.validationIssues || [error.message]));
  }

  try {
    fs.mkdirSync(backupDir, { recursive: true });
    report.checks.backupDir = backupDir;
  } catch (error) {
    report.errors.push(`Backup directory is not writable: ${error.message}`);
  }

  try {
    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    const betsExists = (await db.listCollections({ name: 'bets' }).toArray()).length > 0;

    const [adminCount, agentCount, memberCount, slipCount, itemCount, resultCount, ledgerCount, leagueCount, lotteryCount, rateProfileCount, activeRoundCount] = await Promise.all([
      User.countDocuments({ role: 'admin', isActive: true }),
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'customer' }),
      BetSlip.countDocuments({}),
      BetItem.countDocuments({}),
      ResultRecord.countDocuments({}),
      CreditLedgerEntry.countDocuments({}),
      LotteryLeague.countDocuments({ isActive: true }),
      LotteryType.countDocuments({ isActive: true }),
      RateProfile.countDocuments({ isActive: true }),
      DrawRound.countDocuments({ isActive: true, drawAt: { $gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } })
    ]);

    report.checks.database = {
      connected: true,
      activeAdminCount: adminCount,
      agentCount,
      memberCount,
      slipCount,
      itemCount,
      resultCount,
      ledgerCount,
      legacyBetsCollectionPresent: betsExists
    };

    report.checks.catalog = {
      leagueCount,
      lotteryCount,
      rateProfileCount,
      activeRoundCount
    };

    if (adminCount === 0) {
      report.errors.push('No active admin account exists');
    }

    if (betsExists) {
      report.errors.push('Legacy bets collection still exists');
    }

    if (report.env.autoSeedAdmin) {
      report.warnings.push('AUTO_SEED_ADMIN is enabled; disable it before production unless you explicitly need bootstrap seeding');
    }

    if (report.env.autoSeedCatalog) {
      report.warnings.push('AUTO_SEED_CATALOG is enabled; disable it in production web instances and run `npm run catalog:seed` during deploy instead');
    }

    if (leagueCount === 0 || lotteryCount === 0 || rateProfileCount === 0) {
      report.errors.push('Catalog seed data is missing; run `npm run catalog:seed`');
    }

    if (activeRoundCount === 0) {
      report.errors.push('Catalog rounds are missing or stale; run `npm run catalog:seed`');
    }
  } catch (error) {
    report.errors.push(`Database preflight failed: ${error.message}`);
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  }

  report.finishedAt = new Date().toISOString();
  report.ok = report.errors.length === 0 && (!options.strict || report.warnings.length === 0);

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

main().catch(async (error) => {
  console.error(error.message || error);
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
