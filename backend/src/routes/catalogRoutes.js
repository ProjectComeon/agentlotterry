const express = require('express');
const auth = require('../middleware/auth');
const {
  getCatalogOverview,
  getLotteryOptions,
  getRoundsByLottery,
  markAnnouncementRead
} = require('../services/catalogService');

const router = express.Router();
const getErrorStatus = (error, fallback = 500) => {
  const statusCode = Number(error?.status || error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 ? statusCode : fallback;
};

router.use(auth);

router.get('/overview', async (req, res) => {
  try {
    const overview = await getCatalogOverview(req.user);
    res.json(overview);
  } catch (error) {
    console.error('Catalog overview error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to load catalog overview' });
  }
});

router.get('/lotteries', async (req, res) => {
  try {
    const items = await getLotteryOptions(req.user);
    res.json(items);
  } catch (error) {
    console.error('Catalog lotteries error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to load lottery options' });
  }
});

router.get('/rounds', async (req, res) => {
  try {
    const { lotteryId } = req.query;
    if (!lotteryId) {
      return res.status(400).json({ message: 'lotteryId is required' });
    }

    const rounds = await getRoundsByLottery(lotteryId, req.user);
    res.json(rounds);
  } catch (error) {
    console.error('Catalog rounds error:', error);
    res.status(getErrorStatus(error)).json({ message: error.message || 'Failed to load rounds' });
  }
});

router.post('/announcements/:announcementId/read', async (req, res) => {
  try {
    const result = await markAnnouncementRead({
      viewer: req.user,
      announcementId: req.params.announcementId
    });

    res.json(result);
  } catch (error) {
    const status = error.message?.includes('not found') ? 404 : getErrorStatus(error, 400);
    res.status(status).json({ message: error.message || 'Failed to update announcement state' });
  }
});

module.exports = router;
