require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const { getRoundStatus } = require('../services/catalogService');
const {
  createBangkokDate,
  formatBangkokDate,
  formatBangkokDateTime,
  getBangkokParts
} = require('../utils/bangkokTime');

const MAX_ROUNDS_PER_LOTTERY = Math.max(1, Number(process.env.ROUND_TIMING_AUDIT_LIMIT || 20));

const getBangkokDayStart = (date = new Date()) => {
  const parts = getBangkokParts(date);
  return createBangkokDate(parts.year, parts.month, parts.day, 0, 0);
};

const pad = (value) => String(value).padStart(2, '0');
const getBangkokTimeLabel = (date) => {
  const parts = getBangkokParts(date);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
};

const sameScheduleTime = (date, hour, minute) => {
  const parts = getBangkokParts(date);
  return Number(parts.hour) === Number(hour) && Number(parts.minute) === Number(minute);
};

const buildRoundSummary = (round) => {
  const statusMeta = getRoundStatus(round);
  return {
    code: round.code,
    openAt: formatBangkokDateTime(round.openAt),
    closeAt: formatBangkokDateTime(round.closeAt),
    drawAt: formatBangkokDateTime(round.drawAt),
    closeTime: getBangkokTimeLabel(round.closeAt),
    drawTime: getBangkokTimeLabel(round.drawAt),
    isManualTiming: Boolean(round.isManualTiming),
    bettingOverride: round.bettingOverride || 'auto',
    resultLookupCode: round.resultLookupCode || '',
    status: statusMeta.status
  };
};

const auditLottery = async (lottery, now) => {
  const todayStart = getBangkokDayStart(now);
  const schedule = lottery.schedule || {};
  const rounds = await DrawRound.find({
    lotteryTypeId: lottery._id,
    isActive: true,
    resultPublishedAt: null,
    drawAt: { $gte: todayStart }
  }).sort({ drawAt: 1 }).limit(MAX_ROUNDS_PER_LOTTERY).lean();

  const issues = [];
  for (const round of rounds) {
    const roundSummary = buildRoundSummary(round);
    const closeMs = new Date(round.closeAt).getTime();
    const drawMs = new Date(round.drawAt).getTime();

    if (closeMs > drawMs) {
      issues.push({
        severity: 'error',
        code: 'close-after-draw',
        lotteryCode: lottery.code,
        lotteryName: lottery.name,
        round: roundSummary
      });
      continue;
    }

    if (round.resultLookupCode) {
      continue;
    }

    const closeMatches = sameScheduleTime(round.closeAt, schedule.closeHour, schedule.closeMinute);
    const drawMatches = sameScheduleTime(round.drawAt, schedule.drawHour, schedule.drawMinute);
    if (!closeMatches || !drawMatches) {
      issues.push({
        severity: 'warning',
        code: 'round-time-differs-from-lottery-default',
        lotteryCode: lottery.code,
        lotteryName: lottery.name,
        expected: {
          closeTime: `${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`,
          drawTime: `${pad(schedule.drawHour)}:${pad(schedule.drawMinute)}`
        },
        round: roundSummary
      });
    }

    if (round.isManualTiming && drawMs >= todayStart.getTime() && (!closeMatches || !drawMatches)) {
      issues.push({
        severity: 'info',
        code: 'future-round-has-manual-timing',
        lotteryCode: lottery.code,
        lotteryName: lottery.name,
        detail: 'Saving lottery default timing again will now overwrite future unpublished manual rounds for this lottery.',
        round: roundSummary
      });
    }
  }

  return {
    lotteryCode: lottery.code,
    lotteryName: lottery.name,
    schedule: {
      type: schedule.type,
      closeTime: `${pad(schedule.closeHour)}:${pad(schedule.closeMinute)}`,
      drawTime: `${pad(schedule.drawHour)}:${pad(schedule.drawMinute)}`,
      openLeadDays: schedule.openLeadDays,
      days: schedule.days || null,
      weekdays: schedule.weekdays || null,
      isManualScheduleTiming: Boolean(lottery.isManualScheduleTiming),
      scheduleTimingUpdatedAt: lottery.scheduleTimingUpdatedAt || null
    },
    checkedRounds: rounds.map(buildRoundSummary),
    issueCount: issues.length,
    issues
  };
};

const main = async () => {
  try {
    await connectDB();
    const now = new Date();
    const includeAll = process.argv.includes('--all');
    const lotteries = await LotteryType.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    const reports = [];
    const issues = [];

    for (const lottery of lotteries) {
      if (!lottery.schedule?.type) continue;
      const report = await auditLottery(lottery, now);
      reports.push(report);
      issues.push(...report.issues);
    }

    console.log(JSON.stringify({
      ok: !issues.some((issue) => issue.severity === 'error'),
      generatedAt: now.toISOString(),
      todayBangkok: formatBangkokDate(now),
      counts: {
        lotteriesChecked: reports.length,
        issueCount: issues.length,
        errorCount: issues.filter((issue) => issue.severity === 'error').length,
        warningCount: issues.filter((issue) => issue.severity === 'warning').length,
        infoCount: issues.filter((issue) => issue.severity === 'info').length
      },
      issues,
      lotteries: includeAll ? reports : reports.filter((report) => report.issueCount > 0)
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
