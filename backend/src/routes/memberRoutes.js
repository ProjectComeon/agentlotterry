const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const {
  previewSlip,
  createSlip,
  listSlips,
  getSlipDetail,
  listBetItems,
  cancelSlip,
  getMemberSummary
} = require('../services/betSlipService');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

router.use(auth, authorize('customer'));

router.post('/slips/parse', async (req, res) => {
  try {
    const preview = await previewSlip({
      customerId: req.user._id,
      ...req.body
    });
    res.json(preview);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to parse slip' });
  }
});

router.post('/slips', async (req, res) => {
  try {
    const { action = 'submit' } = req.body;
    const slip = await createSlip({
      customerId: req.user._id,
      ...req.body,
      action
    });

    await createAuditLog(req.user._id, action === 'draft' ? 'CREATE_DRAFT_SLIP' : 'CREATE_MEMBER_SLIP', slip.id, {
      slipNumber: slip.slipNumber,
      lotteryName: slip.lotteryName,
      roundCode: slip.roundCode,
      itemCount: slip.itemCount,
      totalAmount: slip.totalAmount
    });

    res.status(201).json(slip);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to create slip' });
  }
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
