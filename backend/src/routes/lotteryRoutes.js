const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const DrawRound = require('../models/DrawRound');
const LotteryType = require('../models/LotteryType');
const LotteryResult = require('../models/LotteryResult');
const { getExternalSyncState, syncLatestExternalResults } = require('../services/externalResultFeedService');
const { fetchLotteryResult, saveLotteryResult, getLatestResult } = require('../services/lotteryService');
const { getMarketOverview } = require('../services/marketResultsService');
const { createAuditLog } = require('../middleware/auditLog');
const { BET_TYPES } = require('../constants/betting');

const router = express.Router();
const getErrorStatus = (error, fallback = 500) => {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 ? statusCode : fallback;
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
    const results = await LotteryResult.find().sort({ roundDate: -1 }).limit(20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/markets', auth, async (req, res) => {
  try {
    const overview = await getMarketOverview();
    res.json(overview);
  } catch (error) {
    console.error('Market overview error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch market overview' });
  }
});

router.get('/sync-status', auth, authorize('admin'), async (req, res) => {
  res.json(getExternalSyncState());
});

router.post('/sync-latest', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await syncLatestExternalResults();
    await createAuditLog(req.user._id, 'SYNC_LATEST_RESULTS', 'manycai', summary);
    res.json({
      message: 'Latest results synced successfully',
      summary
    });
  } catch (error) {
    console.error('Sync latest results error:', error);
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

module.exports = router;
