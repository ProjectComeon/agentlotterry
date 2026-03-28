const express = require('express');
const auth = require('../middleware/auth');
const { getRecentResults } = require('../services/catalogService');
const { getRoundResult } = require('../services/resultService');

const router = express.Router();

router.use(auth);

router.get('/recent', async (req, res) => {
  try {
    const { lotteryId, limit } = req.query;
    const items = await getRecentResults({
      lotteryId: lotteryId || null,
      limit: Number(limit) || 20
    });

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

    res.json(item);
  } catch (error) {
    console.error('Round result error:', error);
    res.status(500).json({ message: 'Failed to load round result' });
  }
});

module.exports = router;
