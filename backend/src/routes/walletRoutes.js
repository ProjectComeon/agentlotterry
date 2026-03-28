const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');
const {
  getWalletSummary,
  getWalletHistory,
  adjustCreditBalance,
  transferCredit
} = require('../services/walletService');

const router = express.Router();

router.use(auth);

router.get('/summary', async (req, res) => {
  try {
    const summary = await getWalletSummary({
      viewer: req.user,
      targetUserId: req.query.targetUserId || ''
    });

    res.json(summary);
  } catch (error) {
    const status = error.message?.includes('not found') ? 404 : error.message?.includes('access') ? 403 : 400;
    res.status(status).json({ message: error.message || 'Failed to load wallet summary' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const entries = await getWalletHistory({
      viewer: req.user,
      targetUserId: req.query.targetUserId || '',
      limit: req.query.limit || 50,
      direction: req.query.direction || '',
      entryType: req.query.entryType || ''
    });

    res.json(entries);
  } catch (error) {
    const status = error.message?.includes('not found') ? 404 : error.message?.includes('access') ? 403 : 400;
    res.status(status).json({ message: error.message || 'Failed to load wallet history' });
  }
});

router.post('/transfer', authorize('agent'), async (req, res) => {
  try {
    const transfer = await transferCredit({
      actorUserId: req.user._id,
      memberId: req.body.memberId,
      amount: req.body.amount,
      direction: req.body.direction,
      note: req.body.note || ''
    });

    await createAuditLog(req.user._id, 'TRANSFER_CREDIT', transfer.groupId, {
      memberId: req.body.memberId,
      amount: transfer.amount,
      direction: transfer.direction
    });

    res.status(201).json(transfer);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to transfer credit' });
  }
});

router.post('/adjust', authorize('admin'), async (req, res) => {
  try {
    const adjustment = await adjustCreditBalance({
      actorUserId: req.user._id,
      targetUserId: req.body.targetUserId,
      amount: req.body.amount,
      note: req.body.note || '',
      reasonCode: req.body.reasonCode || 'admin_adjustment'
    });

    await createAuditLog(req.user._id, 'ADJUST_CREDIT', adjustment.groupId, {
      targetUserId: req.body.targetUserId,
      amount: req.body.amount,
      reasonCode: req.body.reasonCode || 'admin_adjustment'
    });

    res.status(201).json(adjustment);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to adjust credit' });
  }
});

module.exports = router;
