const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const {
  createSlip,
  listSlips,
  getSlipDetail,
  listBetItems,
  cancelSlip,
  getMemberSummary
} = require('../services/betSlipService');
const { createAuditLog } = require('../middleware/auditLog');
const { getWalletSummary } = require('../services/walletService');
const { getRoundsByLottery } = require('../services/catalogService');
const { clearAnalyticsReadCache } = require('../services/analyticsService');
const { scheduleReadModelSnapshotRebuild } = require('../services/readModelSnapshotService');
const {
  listNotifications,
  listPendingPayouts,
  markNotificationRead
} = require('../services/pendingPayoutNotificationService');

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const assertMemberOwnSlipRequest = (req) => {
  const requestedCustomerId = String(req.body?.customerId || '').trim();
  if (requestedCustomerId && requestedCustomerId !== toIdString(req.user)) {
    const error = new Error('Members can only create slips for their own account');
    error.status = 403;
    throw error;
  }

  if (req.body?.agentId) {
    const error = new Error('Members cannot choose an agent for slip submission');
    error.status = 403;
    throw error;
  }
};

const buildSlipAuditPayload = ({ slip }) => ({
  customerId: slip.customerId,
  slipNumber: slip.slipNumber,
  lotteryName: slip.lotteryName,
  roundCode: slip.roundCode,
  itemCount: slip.itemCount,
  totalAmount: slip.totalAmount
});

const createMemberSlip = async (req, res, action) => {
  try {
    assertMemberOwnSlipRequest(req);
    const slip = await createSlip({
      ...req.body,
      actorUser: req.user,
      customerId: req.user._id,
      action
    });

    await createAuditLog(
      req.user._id,
      action === 'draft' ? 'MEMBER_CREATE_DRAFT_SLIP' : 'MEMBER_CREATE_SLIP',
      slip.id,
      buildSlipAuditPayload({ slip })
    );
    clearAnalyticsReadCache();
    scheduleReadModelSnapshotRebuild({
      reason: 'member-betting-slip-create',
      agentIds: req.user.agentId ? [req.user.agentId] : []
    });

    res.status(201).json(slip);
  } catch (error) {
    const status = error.status || 400;
    res.status(status).json({ message: error.message || 'Failed to create slip' });
  }
};
const serializeMember = (user) => ({
  id: user._id?.toString?.() || user.id || '',
  username: user.username || '',
  name: user.name || '',
  role: user.role || '',
  displayRole: user.displayRole || 'member',
  agentId: user.agentId?.toString?.() || '',
  parentUserId: user.parentUserId?.toString?.() || '',
  phone: user.phone || '',
  creditBalance: Number(user.creditBalance || 0),
  status: user.status || '',
  isActive: Boolean(user.isActive)
});

const router = express.Router();

router.use(auth, authorize('customer'));

router.get('/me', async (req, res) => {
  res.json({ member: serializeMember(req.user) });
});

router.get('/wallet', async (req, res) => {
  try {
    res.json(await getWalletSummary({ viewer: req.user }));
  } catch (error) {
    const status = error.message?.includes('access') ? 403 : error.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Failed to load wallet' });
  }
});

router.get('/rounds', async (req, res) => {
  try {
    const lotteryId = req.query.lotteryId || '';
    if (!lotteryId) {
      return res.status(400).json({ message: 'lotteryId is required' });
    }

    res.json(await getRoundsByLottery(lotteryId, req.user));
  } catch (error) {
    const status = Number(error.status || error.statusCode || 400);
    res.status(status >= 400 ? status : 400).json({ message: error.message || 'Failed to load rounds' });
  }
});

router.post('/slips/draft', async (req, res) => createMemberSlip(req, res, 'draft'));
router.post('/slips/submit', async (req, res) => createMemberSlip(req, res, 'submit'));
router.get('/pending-payouts', async (req, res) => {
  try {
    res.json(await listPendingPayouts({ role: 'customer', userId: req.user._id, query: req.query }));
  } catch (error) {
    console.error('Member pending payouts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    res.json(await listNotifications({ role: 'customer', userId: req.user._id, query: req.query }));
  } catch (error) {
    console.error('Member notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await markNotificationRead({
      role: 'customer',
      userId: req.user._id,
      notificationId: req.params.id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Member notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/slips/parse', async (req, res) => {
  return res.status(403).json({
    message: 'สมาชิกไม่สามารถซื้อเองได้ กรุณาให้เอเย่นต์หรือแอดมินทำรายการแทน'
  });
});

router.post('/slips', async (req, res) => {
  return res.status(403).json({
    message: 'สมาชิกไม่สามารถซื้อเองได้ กรุณาให้เอเย่นต์หรือแอดมินทำรายการแทน'
  });
});

router.get('/slips', async (req, res) => {
  try {
    const slips = await listSlips({
      customerId: req.user._id,
      status: req.query.status || ''
    });
    res.json(slips);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load slips' });
  }
});

router.get('/slips/:slipId', async (req, res) => {
  try {
    const slip = await getSlipDetail({
      customerId: req.user._id,
      slipId: req.params.slipId
    });
    res.json(slip);
  } catch (error) {
    res.status(404).json({ message: error.message || 'Slip not found' });
  }
});

router.post('/slips/:slipId/cancel', async (req, res) => {
  try {
    const slip = await cancelSlip({
      customerId: req.user._id,
      slipId: req.params.slipId
    });

    await createAuditLog(req.user._id, 'CANCEL_MEMBER_SLIP', slip.id, {
      slipNumber: slip.slipNumber
    });

    res.json(slip);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to cancel slip' });
  }
});

router.get('/bets', async (req, res) => {
  try {
    const items = await listBetItems({
      customerId: req.user._id,
      slipId: req.query.slipId || '',
      status: req.query.status || ''
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load bet items' });
  }
});

router.get('/reports/summary', async (req, res) => {
  try {
    const summary = await getMemberSummary({
      customerId: req.user._id,
      lotteryId: req.query.lotteryId || '',
      marketId: req.query.marketId || '',
      roundCode: req.query.roundCode || '',
      roundDate: req.query.roundDate || ''
    });

    res.json(summary);
  } catch (error) {
    console.error('Member summary error:', error);
    res.status(500).json({ message: 'Failed to load member summary' });
  }
});

module.exports = router;
