const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const LotteryResult = require('../models/LotteryResult');
const { fetchLotteryResult, saveLotteryResult, getLatestResult } = require('../services/lotteryService');
const { getMarketOverview } = require('../services/marketResultsService');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

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
    res.status(500).json({ message: error.message || 'Failed to fetch lottery result' });
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
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
