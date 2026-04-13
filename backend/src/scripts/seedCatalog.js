require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Announcement = require('../models/Announcement');
const DrawRound = require('../models/DrawRound');
const LotteryLeague = require('../models/LotteryLeague');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const { ensureCatalogSeed } = require('../services/catalogService');

const main = async () => {
  try {
    await connectDB();
    const readiness = await ensureCatalogSeed({ force: true });

    const [leagueCount, lotteryCount, rateProfileCount, announcementCount, activeRoundCount] = await Promise.all([
      LotteryLeague.countDocuments({ isActive: true }),
      LotteryType.countDocuments({ isActive: true }),
      RateProfile.countDocuments({ isActive: true }),
      Announcement.countDocuments({ isActive: true }),
      DrawRound.countDocuments({ isActive: true, drawAt: { $gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } })
    ]);

    console.log(JSON.stringify({
      ok: true,
      seededAt: new Date().toISOString(),
      readiness,
      counts: {
        leagueCount,
        lotteryCount,
        rateProfileCount,
        announcementCount,
        activeRoundCount
      }
    }, null, 2));
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  }
};

main();
