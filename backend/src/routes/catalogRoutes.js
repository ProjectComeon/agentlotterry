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
const parseBooleanQuery = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === true || value === 'true' || value === '1';
};
const applyNoStore = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

router.use(auth);

router.get('/overview', async (req, res) => {
  try {
    const requestedVariant = String(req.query.variant || '').trim().toLowerCase();
    const variant = ['lottery-page', 'betting'].includes(requestedVariant) ? requestedVariant : 'full';
    const compactVariant = variant !== 'full';
    const overview = await getCatalogOverview(req.user, {
      cacheVariant: variant,
      includeAnnouncements: parseBooleanQuery(req.query.includeAnnouncements, !compactVariant),
      includeRecentResults: parseBooleanQuery(req.query.includeRecentResults, !compactVariant)
    });
    applyNoStore(res);
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
