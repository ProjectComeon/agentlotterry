const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const cronAuth = require('../middleware/cronAuth');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const { getExternalSyncState, syncLatestExternalResults } = require('../services/externalResultFeedService');
const { fetchLotteryResult, saveLotteryResult, getLatestResult, getRecentResults } = require('../services/lotteryService');
const { getMarketOverview } = require('../services/marketResultsService');
const { createAuditLog } = require('../middleware/auditLog');
const { BET_TYPES } = require('../constants/betting');
const { clearCatalogOverviewCache, getRoundStatus, normalizeRoundTimingPayload } = require('../services/catalogService');
const { clearAnalyticsReadCache } = require('../services/analyticsService');
const { getReadModelSnapshotState, scheduleReadModelSnapshotRebuild } = require('../services/readModelSnapshotService');
const {
  reconcileRoundSettlementById,
  reverseRoundSettlementById,
  rerunRoundSettlementById
} = require('../services/resultService');

const router = express.Router();
const ROUND_BETTING_OVERRIDES = ['auto', 'open', 'closed'];
const getErrorStatus = (error, fallback = 500) => {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 ? statusCode : fallback;
};
const applyNoStore = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};
const scheduleCatalogRefresh = (reason) => {
  clearCatalogOverviewCache({ includeSnapshots: false });
  clearAnalyticsReadCache();
  scheduleReadModelSnapshotRebuild({ reason });
};
const scheduleSettlementRefresh = (reason) => {
  clearCatalogOverviewCache({ includeSnapshots: false });
  clearAnalyticsReadCache();
  scheduleReadModelSnapshotRebuild({ reason, includeAgents: true });
};

router.get('/latest', auth, async (req, res) => {
  try {
    const result = await getLatestResult();
    if (!result) {
      return res.json({ message: 'No lottery results available', result: null });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/results', auth, async (req, res) => {
  try {
    const results = await getRecentResults(20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/markets', auth, async (req, res) => {
  try {
    const overview = await getMarketOverview();
    applyNoStore(res);
    res.json(overview);
  } catch (error) {
    console.error('Market overview error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch market overview' });
  }
});

router.get('/sync-status', auth, authorize('admin'), async (req, res) => {
  res.json({
    ...getExternalSyncState(),
    readModelSnapshots: getReadModelSnapshotState()
  });
});

router.post('/sync-latest', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await syncLatestExternalResults({ runSettlement: false });
    clearAnalyticsReadCache();
    await createAuditLog(req.user._id, 'SYNC_LATEST_RESULTS_FETCH_STORE', 'manycai', summary);
    res.json({
      message: 'Latest results synced successfully with deferred settlement',
      summary
    });
  } catch (error) {
    console.error('Sync latest results error:', error);
    res.status(500).json({ message: error.message || 'Failed to sync latest results' });
  }
});

router.post('/sync-latest/cron', cronAuth, async (req, res) => {
  try {
    const summary = await syncLatestExternalResults();
    clearAnalyticsReadCache();
    res.json({
      message: 'Latest results synced successfully',
      trigger: req.cronAuth?.trigger || 'external-cron',
      summary
    });
  } catch (error) {
    console.error('Cron sync latest results error:', error);
    res.status(500).json({ message: error.message || 'Failed to sync latest results' });
  }
});

router.post('/fetch', auth, authorize('admin'), async (req, res) => {
  try {
    const { roundDate } = req.body;

    if (!roundDate) {
      return res.status(400).json({ message: 'Round date is required (format: YYYY-MM-DD)' });
    }

    const resultData = await fetchLotteryResult(roundDate);
    const saved = await saveLotteryResult({
      ...resultData,
      sourceType: 'api'
    });

    await createAuditLog(req.user._id, 'FETCH_LOTTERY', roundDate, saved.settlement || {});
    scheduleSettlementRefresh('lottery-fetch-result');

    res.json({
      message: 'Lottery result fetched, saved, and settled successfully',
      result: saved.result,
      settlement: saved.settlement
    });
  } catch (error) {
    console.error('Fetch lottery error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to fetch lottery result' });
  }
});

router.post('/manual', auth, authorize('admin'), async (req, res) => {
  try {
    const { roundDate, firstPrize, threeTopList, threeBotList, twoBottom, runTop, runBottom } = req.body;

    if (!roundDate || !firstPrize) {
      return res.status(400).json({ message: 'Round date and first prize are required' });
    }

    const resultData = {
      roundDate,
      firstPrize,
      threeTopList: threeTopList || [],
      threeBotList: threeBotList || [],
      twoBottom: twoBottom || firstPrize.slice(-2),
      runTop: runTop || [],
      runBottom: runBottom || [],
      fetchedAt: new Date(),
      sourceType: 'manual'
    };

    const saved = await saveLotteryResult(resultData);
    await createAuditLog(req.user._id, 'MANUAL_LOTTERY', roundDate, saved.settlement || {});
    scheduleSettlementRefresh('lottery-manual-result');

    res.json({
      message: 'Lottery result saved and settled successfully',
      result: saved.result,
      settlement: saved.settlement
    });
  } catch (error) {
    console.error('Manual lottery error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Server error' });
  }
});

router.put('/rounds/:roundId/closed-bet-types', auth, authorize('admin'), async (req, res) => {
  try {
    const { closedBetTypes = [] } = req.body;
    const round = await DrawRound.findById(req.params.roundId);

    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }

    const lottery = await LotteryType.findById(round.lotteryTypeId).select('supportedBetTypes name code');
    if (!lottery) {
      return res.status(404).json({ message: 'Lottery type not found' });
    }

    const normalizedClosedBetTypes = [...new Set((Array.isArray(closedBetTypes) ? closedBetTypes : [])
      .filter((betType) => BET_TYPES.includes(betType)))];
    const invalidBetType = normalizedClosedBetTypes.find((betType) => !lottery.supportedBetTypes.includes(betType));

    if (invalidBetType) {
      return res.status(400).json({ message: `${invalidBetType} is not supported by this lottery` });
    }

    round.closedBetTypes = normalizedClosedBetTypes;
    await round.save();
    scheduleCatalogRefresh('round-closed-bet-types-update');

    await createAuditLog(req.user._id, 'UPDATE_ROUND_CLOSED_BET_TYPES', round._id.toString(), {
      lotteryCode: lottery.code,
      roundCode: round.code,
      closedBetTypes: normalizedClosedBetTypes
    });

    res.json({
      id: round._id.toString(),
      roundCode: round.code,
      lotteryCode: lottery.code,
      lotteryName: lottery.name,
      closedBetTypes: round.closedBetTypes || []
    });
  } catch (error) {
    console.error('Update round closed bet types error:', error);
    res.status(500).json({ message: error.message || 'Failed to update round closed bet types' });
  }
});

router.put('/rounds/:roundId/betting-override', auth, authorize('admin'), async (req, res) => {
  try {
    const bettingOverride = String(req.body?.bettingOverride || '').trim().toLowerCase();
    if (!ROUND_BETTING_OVERRIDES.includes(bettingOverride)) {
      return res.status(400).json({ message: 'bettingOverride must be auto, open, or closed' });
    }

    const round = await DrawRound.findById(req.params.roundId);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }

    if (round.resultPublishedAt) {
      return res.status(400).json({ message: 'This round already has published results' });
    }

    const lottery = await LotteryType.findById(round.lotteryTypeId).select('name code');
    if (!lottery) {
      return res.status(404).json({ message: 'Lottery type not found' });
    }

    const previousOverride = round.bettingOverride || 'auto';
    round.bettingOverride = bettingOverride;

    const statusMeta = getRoundStatus(round);
    round.status = statusMeta.status;
    await round.save();
    scheduleCatalogRefresh('round-betting-override-update');

    await createAuditLog(req.user._id, 'UPDATE_ROUND_BETTING_OVERRIDE', round._id.toString(), {
      lotteryCode: lottery.code,
      roundCode: round.code,
      previousOverride,
      bettingOverride,
      effectiveStatus: statusMeta.status
    });

    res.json({
      id: round._id.toString(),
      roundCode: round.code,
      lotteryCode: lottery.code,
      lotteryName: lottery.name,
      bettingOverride,
      status: statusMeta.status,
      isManualOverride: statusMeta.isManualOverride
    });
  } catch (error) {
    console.error('Update round betting override error:', error);
    res.status(500).json({ message: error.message || 'Failed to update round betting override' });
  }
});

router.put('/rounds/:roundId/timing', auth, authorize('admin'), async (req, res) => {
  try {
    const round = await DrawRound.findById(req.params.roundId);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }

    if (round.resultPublishedAt) {
      return res.status(400).json({ message: 'This round already has published results' });
    }

    const lottery = await LotteryType.findById(round.lotteryTypeId).select('name code');
    if (!lottery) {
      return res.status(404).json({ message: 'Lottery type not found' });
    }

    const previousTiming = {
      openAt: round.openAt,
      closeAt: round.closeAt
    };
    const { openAt, closeAt } = normalizeRoundTimingPayload(req.body, round);

    round.openAt = openAt;
    round.closeAt = closeAt;
    round.isManualTiming = true;
    round.timingUpdatedAt = new Date();
    round.timingUpdatedBy = req.user._id;

    const statusMeta = getRoundStatus(round);
    round.status = statusMeta.status;
    await round.save();
    scheduleCatalogRefresh('round-timing-update');

    await createAuditLog(req.user._id, 'UPDATE_ROUND_TIMING', round._id.toString(), {
      lotteryCode: lottery.code,
      roundCode: round.code,
      previousTiming,
      openAt,
      closeAt,
      effectiveStatus: statusMeta.status
    });

    res.json({
      id: round._id.toString(),
      roundCode: round.code,
      lotteryCode: lottery.code,
      lotteryName: lottery.name,
      openAt: round.openAt,
      closeAt: round.closeAt,
      drawAt: round.drawAt,
      isManualTiming: round.isManualTiming,
      timingUpdatedAt: round.timingUpdatedAt,
      status: statusMeta.status,
      statusLabel: statusMeta.label,
      countdownSeconds: statusMeta.countdownSeconds
    });
  } catch (error) {
    console.error('Update round timing error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to update round timing' });
  }
});

router.get('/rounds/:roundId/settlement/reconcile', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await reconcileRoundSettlementById(req.params.roundId);
    await createAuditLog(req.user._id, 'RECONCILE_ROUND_SETTLEMENT', req.params.roundId, summary);
    scheduleSettlementRefresh('round-settlement-reconcile');
    res.json(summary);
  } catch (error) {
    console.error('Reconcile round settlement error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to reconcile round settlement' });
  }
});

router.post('/rounds/:roundId/settlement/reverse', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await reverseRoundSettlementById(req.params.roundId);
    await createAuditLog(req.user._id, 'REVERSE_ROUND_SETTLEMENT', req.params.roundId, summary);
    scheduleSettlementRefresh('round-settlement-reverse');
    res.json({
      message: 'Round settlement reversed successfully',
      summary
    });
  } catch (error) {
    console.error('Reverse round settlement error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to reverse round settlement' });
  }
});

router.post('/rounds/:roundId/settlement/rerun', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await rerunRoundSettlementById(req.params.roundId);
    await createAuditLog(req.user._id, 'RERUN_ROUND_SETTLEMENT', req.params.roundId, summary);
    scheduleSettlementRefresh('round-settlement-rerun');
    res.json({
      message: 'Round settlement rerun successfully',
      summary
    });
  } catch (error) {
    console.error('Rerun round settlement error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to rerun round settlement' });
  }
});

module.exports = router;
