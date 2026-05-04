require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const { getRoundStatus, selectCatalogActiveRound } = require('../services/catalogService');
const { rebuildReadModelSnapshots } = require('../services/readModelSnapshotService');
const { createBangkokDate, formatBangkokDateTime } = require('../utils/bangkokTime');

const LOTTERY_CODE = 'thai_government';
const MISSED_ROUND_CODE = '2026-05-01';
const NEXT_ROUND_CODE = '2026-05-16';

const toPlainTiming = (round) => {
  if (!round) return null;
  return {
    code: round.code,
    openAt: formatBangkokDateTime(round.openAt),
    closeAt: formatBangkokDateTime(round.closeAt),
    drawAt: formatBangkokDateTime(round.drawAt),
    resultLookupCode: round.resultLookupCode || '',
    bettingOverride: round.bettingOverride || 'auto',
    isManualTiming: Boolean(round.isManualTiming),
    status: round.status
  };
};

const getScheduledTimingForCode = (schedule = {}, roundCode) => {
  const [year, month, day] = roundCode.split('-').map(Number);
  const drawAt = createBangkokDate(
    year,
    month,
    day,
    Number(schedule.drawHour || 16),
    Number(schedule.drawMinute || 0)
  );
  const closeAt = createBangkokDate(
    year,
    month,
    day,
    Number(schedule.closeHour || schedule.drawHour || 15),
    Number(schedule.closeMinute || 0)
  );
  const openAt = new Date(drawAt.getTime() - (Number(schedule.openLeadDays) || 7) * 24 * 60 * 60 * 1000);

  return { openAt, closeAt, drawAt };
};

const closeMissedRoundIfNeeded = async (lottery) => {
  const round = await DrawRound.findOne({
    lotteryTypeId: lottery._id,
    code: MISSED_ROUND_CODE
  });
  if (!round || round.resultPublishedAt) {
    return round;
  }

  round.bettingOverride = 'closed';
  round.status = getRoundStatus(round).status;
  round.timingUpdatedAt = new Date();
  await round.save();
  return round;
};

const openNextRound = async (lottery) => {
  const scheduledTiming = getScheduledTimingForCode(lottery.schedule || {}, NEXT_ROUND_CODE);
  const now = new Date();
  const openAt = now < scheduledTiming.closeAt ? now : scheduledTiming.openAt;

  const round = await DrawRound.findOneAndUpdate(
    {
      lotteryTypeId: lottery._id,
      code: NEXT_ROUND_CODE
    },
    {
      $set: {
        title: `Round ${NEXT_ROUND_CODE}`,
        openAt,
        closeAt: scheduledTiming.closeAt,
        drawAt: scheduledTiming.drawAt,
        resultLookupCode: '',
        bettingOverride: 'auto',
        isManualTiming: true,
        timingUpdatedAt: now,
        isActive: true
      }
    },
    {
      new: true,
      upsert: true
    }
  );

  round.status = getRoundStatus(round).status;
  await round.save();
  return round;
};

const main = async () => {
  try {
    await connectDB();

    const lottery = await LotteryType.findOne({ code: LOTTERY_CODE });
    if (!lottery) {
      throw new Error(`Lottery not found: ${LOTTERY_CODE}`);
    }

    const beforeRounds = await DrawRound.find({
      lotteryTypeId: lottery._id,
      code: { $in: [MISSED_ROUND_CODE, NEXT_ROUND_CODE] }
    }).sort({ drawAt: 1 }).lean();

    const missedRound = await closeMissedRoundIfNeeded(lottery);
    const nextRound = await openNextRound(lottery);

    const candidateRounds = await DrawRound.find({
      lotteryTypeId: lottery._id,
      isActive: true,
      resultPublishedAt: null,
      drawAt: { $gte: createBangkokDate(2026, 5, 1, 0, 0) }
    }).sort({ drawAt: 1 }).lean();
    const selectedRound = selectCatalogActiveRound(candidateRounds, new Date());

    const snapshot = await rebuildReadModelSnapshots({
      reason: 'activate-thai-government-2026-05-16-round',
      targets: ['catalog', 'market']
    });

    console.log(JSON.stringify({
      ok: selectedRound?.code === NEXT_ROUND_CODE,
      lotteryCode: lottery.code,
      lotteryName: lottery.name,
      before: beforeRounds.map(toPlainTiming),
      after: {
        missedRound: toPlainTiming(missedRound),
        nextRound: toPlainTiming(nextRound),
        selectedRound: toPlainTiming(selectedRound)
      },
      snapshot
    }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  }
};

main();
