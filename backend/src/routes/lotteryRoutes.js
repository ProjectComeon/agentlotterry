const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const LotteryResult = require('../models/LotteryResult');
const { fetchLotteryResult, saveLotteryResult, getLatestResult } = require('../services/lotteryService');
const { calculateResults } = require('../services/calculationService');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

// GET /api/lottery/latest - ดูผลหวยล่าสุด (all roles)
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

// GET /api/lottery/results - ดูผลหวยทั้งหมด
router.get('/results', auth, async (req, res) => {
  try {
    const results = await LotteryResult.find().sort({ roundDate: -1 }).limit(20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/lottery/fetch - ดึงผลหวยจาก API (Admin only)
router.post('/fetch', auth, authorize('admin'), async (req, res) => {
  try {
    const { roundDate } = req.body;

    if (!roundDate) {
      return res.status(400).json({ message: 'Round date is required (format: YYYY-MM-DD)' });
    }

    const resultData = await fetchLotteryResult(roundDate);
    const saved = await saveLotteryResult(resultData);

    await createAuditLog(req.user._id, 'FETCH_LOTTERY', roundDate);

    res.json({
      message: 'Lottery result fetched and saved successfully',
      result: saved
    });
  } catch (error) {
    console.error('Fetch lottery error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch lottery result' });
  }
});

// POST /api/lottery/manual - บันทึกผลหวยเอง (Admin only)
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
      fetchedAt: new Date()
    };

    const saved = await saveLotteryResult(resultData);
    await createAuditLog(req.user._id, 'MANUAL_LOTTERY', roundDate, resultData);

    res.json({
      message: 'Lottery result saved successfully',
      result: saved
    });
  } catch (error) {
    console.error('Manual lottery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/lottery/calculate - คำนวณผล (Admin only)
router.post('/calculate', auth, authorize('admin'), async (req, res) => {
  try {
    const { roundDate } = req.body;

    if (!roundDate) {
      return res.status(400).json({ message: 'Round date is required' });
    }

    const result = await calculateResults(roundDate);
    await createAuditLog(req.user._id, 'CALCULATE_RESULTS', roundDate, result);

    res.json({
      message: 'Results calculated and bets locked successfully',
      ...result
    });
  } catch (error) {
    console.error('Calculate error:', error);
    res.status(500).json({ message: error.message || 'Failed to calculate results' });
  }
});

module.exports = router;
