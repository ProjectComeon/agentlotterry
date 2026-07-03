const express = require('express');
const auth = require('../middleware/auth');
const { getRecentResults } = require('../services/catalogService');
const { getRoundResult } = require('../services/resultService');
const { normalizeBoundedLimit } = require('../utils/pagination');

const router = express.Router();
const applyNoStore = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

router.use(auth);

router.get('/recent', async (req, res) => {
  try {
    const { lotteryId, limit } = req.query;
    const items = await getRecentResults({
      lotteryId: lotteryId || null,
      limit: normalizeBoundedLimit(limit, { defaultLimit: 50, maxLimit: 100 })
    });

    applyNoStore(res);
    res.json(items);
  } catch (error) {
    console.error('Recent results error:', error);
    res.status(500).json({ message: 'Failed to load results' });
  }
});

router.get('/round/:roundId', async (req, res) => {
  try {
    const item = await getRoundResult(req.params.roundId);
    if (!item) {
      return res.status(404).json({ message: 'Result not found' });
    }

    applyNoStore(res);
    res.json(item);
  } catch (error) {
    console.error('Round result error:', error);
    res.status(500).json({ message: 'Failed to load round result' });
  }
});

module.exports = router;
