const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');
const {
  getBetTotals,
  getRecentBetItems,
  getTotalsGroupedByField,
  getAgentReportRows,
  listAgentBetItems,
  listBettingRecentItems,
  getAgentReportsBundle
} = require('../services/analyticsService');
const {
  previewSlip,
  createSlip,
  cancelSlipByActor
} = require('../services/betSlipService');
const { getCatalogOverview } = require('../services/catalogService');
const {
  getAgentMemberBootstrap,
  getAgentMembers,
  getAgentMemberDetail,
  createAgentMember,
  updateAgentMember,
  deactivateAgentMember,
  isUserOnline,
  searchMembersForBetting,
  getMemberForBettingActor
} = require('../services/memberManagementService');
const {
  getDraftSession,
  saveDraftSession,
  clearDraftSession
} = require('../services/bettingDraftService');

const router = express.Router();

// All agent routes require auth + agent role
router.use(auth, authorize('agent'));

// GET /api/agent/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const agentId = req.user._id;
    const onlineSince = new Date(Date.now() - 5 * 60 * 1000);
    const [totalCustomers, activeCustomers, onlineCustomers, memberRows, betStats, recentBets, onlineMemberRows] = await Promise.all([
      User.countDocuments({ agentId, role: 'customer' }),
      User.countDocuments({ agentId, role: 'customer', isActive: true }),
      User.countDocuments({
        agentId,
        role: 'customer',
        isActive: true,
        status: 'active',
        lastActiveAt: { $gte: onlineSince }
      }),
      User.find({ agentId, role: 'customer' })
        .select('creditBalance stockPercent isActive status lastActiveAt'),
      getBetTotals({ agentId }),
      getRecentBetItems({ agentId, limit: 10 }),
      User.find({
        agentId,
        role: 'customer',
        isActive: true,
        status: 'active',
        lastActiveAt: { $gte: onlineSince }
      })
        .select('name username memberCode lastActiveAt')
        .sort({ lastActiveAt: -1 })
        .limit(6)
    ]);

    const totalCreditBalance = memberRows.reduce((sum, member) => sum + (member.creditBalance || 0), 0);
    const averageStockPercent = memberRows.length
      ? memberRows.reduce((sum, member) => sum + (member.stockPercent || 0), 0) / memberRows.length
      : 0;

    res.json({
      stats: {
        totalCustomers,
        activeCustomers,
        onlineCustomers,
        agentCreditBalance: req.user.creditBalance || 0,
        totalBets: betStats.totalBets,
        pendingBets: betStats.pendingBets,
        totalAmount: betStats.totalAmount,
        totalWon: betStats.totalWon,
        netProfit: betStats.netProfit,
        totalCreditBalance,
        averageStockPercent
      },
      recentBets
      ,
      onlineMembers: onlineMemberRows.map((member) => ({
        id: member._id.toString(),
        name: member.name,
        username: member.username,
        memberCode: member.memberCode || '',
        lastActiveAt: member.lastActiveAt,
        isOnline: isUserOnline(member)
      }))
    });
  } catch (error) {
    console.error('Agent dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/config/bootstrap
router.get('/config/bootstrap', async (req, res) => {
  try {
    const bootstrap = await getAgentMemberBootstrap({ agentId: req.user._id });
    res.json(bootstrap);
  } catch (error) {
    console.error('Agent config bootstrap error:', error);
    res.status(500).json({ message: 'Failed to load member config bootstrap' });
  }
});

// GET /api/agent/betting/members/search
router.get('/betting/members/search', async (req, res) => {
  try {
    const members = await searchMembersForBetting({
      actorId: req.user._id,
      actorRole: req.user.role,
      search: req.query.q || req.query.search || '',
      limit: req.query.limit || 20
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to search members' });
  }
});

// GET /api/agent/betting/members/:memberId/context
router.get('/betting/members/:memberId/context', async (req, res) => {
  try {
    const member = await getMemberForBettingActor({
      actorId: req.user._id,
      actorRole: req.user.role,
      memberId: req.params.memberId
    });

    const [catalog, totals] = await Promise.all([
      getCatalogOverview(member),
      getBetTotals({ agentId: req.user._id, customerId: member._id })
    ]);

    res.json({
      member: {
        id: member._id.toString(),
        uid: member._id.toString(),
        name: member.name,
        username: member.username,
        phone: member.phone || '',
        creditBalance: member.creditBalance || 0,
        status: member.status,
        isActive: member.isActive,
        totals: {
          totalAmount: totals.totalAmount || 0,
          totalWon: totals.totalWon || 0,
          netProfit: totals.netProfit || 0
        }
      },
      catalog
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to load member betting context' });
  }
});

// POST /api/agent/betting/slips/parse
router.post('/betting/slips/parse', async (req, res) => {
  try {
    const preview = await previewSlip({
      actorUser: req.user,
      customerId: req.body.customerId,
      ...req.body
    });

    res.json(preview);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to parse slip' });
  }
});

// POST /api/agent/betting/slips
router.post('/betting/slips', async (req, res) => {
  try {
    const { action = 'submit' } = req.body;
    const slip = await createSlip({
      actorUser: req.user,
      customerId: req.body.customerId,
      ...req.body,
      action
    });

    await createAuditLog(req.user._id, action === 'draft' ? 'AGENT_CREATE_DRAFT_SLIP_FOR_MEMBER' : 'AGENT_CREATE_MEMBER_SLIP', slip.id, {
      customerId: req.body.customerId,
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

// POST /api/agent/betting/slips/:slipId/cancel
router.post('/betting/slips/:slipId/cancel', async (req, res) => {
  try {
    const slip = await cancelSlipByActor({
      actorUser: req.user,
      slipId: req.params.slipId
    });

    await createAuditLog(req.user._id, 'AGENT_CANCEL_MEMBER_SLIP', slip.id, {
      slipNumber: slip.slipNumber,
      customerId: slip.customerId
    });

    res.json(slip);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to cancel slip' });
  }
});

// GET /api/agent/betting/items/recent
router.get('/betting/items/recent', async (req, res) => {
  try {
    const items = await listBettingRecentItems({
      actorRole: req.user.role,
      actorId: req.user._id,
      customerId: req.query.customerId || '',
      marketId: req.query.marketId || '',
      roundDate: req.query.roundDate || '',
      limit: Number(req.query.limit || 12)
    });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load recent betting items' });
  }
});

// GET /api/agent/betting/draft
router.get('/betting/draft', async (req, res) => {
  try {
    const draft = await getDraftSession({
      actorUser: req.user,
      customerId: req.query.customerId,
      lotteryId: req.query.lotteryId,
      roundId: req.query.roundId,
      rateProfileId: req.query.rateProfileId || ''
    });

    res.json(draft);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to load betting draft' });
  }
});

// PUT /api/agent/betting/draft
router.put('/betting/draft', async (req, res) => {
  try {
    const draft = await saveDraftSession({
      actorUser: req.user,
      customerId: req.body.customerId,
      lotteryId: req.body.lotteryId,
      roundId: req.body.roundId,
      rateProfileId: req.body.rateProfileId || '',
      composer: req.body.composer || null,
      savedEntries: req.body.savedEntries || []
    });

    res.json(draft);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to save betting draft' });
  }
});

// DELETE /api/agent/betting/draft
router.delete('/betting/draft', async (req, res) => {
  try {
    const draft = await clearDraftSession({
      actorUser: req.user,
      customerId: req.body.customerId,
      lotteryId: req.body.lotteryId,
      roundId: req.body.roundId,
      rateProfileId: req.body.rateProfileId || ''
    });

    res.json(draft);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to clear betting draft' });
  }
});

// GET /api/agent/config/members/:id
router.get('/config/members/:id', async (req, res) => {
  try {
    const detail = await getAgentMemberDetail({
      agentId: req.user._id,
      memberId: req.params.id
    });

    res.json({
      member: detail.member,
      lotteryConfigs: detail.lotteryConfigs
    });
  } catch (error) {
    res.status(404).json({ message: error.message || 'Member not found' });
  }
});

// PUT /api/agent/config/members/:id/lotteries
router.put('/config/members/:id/lotteries', async (req, res) => {
  try {
    const detail = await updateAgentMember({
      agentId: req.user._id,
      memberId: req.params.id,
      payload: {
        lotterySettings: req.body.lotterySettings || []
      }
    });

    await createAuditLog(req.user._id, 'UPDATE_MEMBER_LOTTERY_CONFIG', detail.member.id, {
      enabledLotteryCount: detail.lotteryConfigs.filter((lottery) => lottery.isEnabled).length
    });

    res.json({
      member: detail.member,
      lotteryConfigs: detail.lotteryConfigs
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update lottery config' });
  }
});

// GET /api/agent/members
router.get('/members', async (req, res) => {
  try {
    const members = await getAgentMembers({
      agentId: req.user._id,
      search: req.query.search || '',
      status: req.query.status || '',
      online: req.query.online || ''
    });

    res.json(members);
  } catch (error) {
    console.error('Agent members list error:', error);
    res.status(500).json({ message: 'Failed to load members' });
  }
});

// GET /api/agent/members/:id
router.get('/members/:id', async (req, res) => {
  try {
    const detail = await getAgentMemberDetail({
      agentId: req.user._id,
      memberId: req.params.id
    });

    res.json(detail);
  } catch (error) {
    res.status(404).json({ message: error.message || 'Member not found' });
  }
});

// POST /api/agent/members
router.post('/members', async (req, res) => {
  try {
    const detail = await createAgentMember({
      agentId: req.user._id,
      payload: req.body
    });

    await createAuditLog(req.user._id, 'CREATE_MEMBER', detail.member.id, {
      username: detail.member.username,
      name: detail.member.name,
      memberCode: detail.member.memberCode
    });

    res.status(201).json(detail);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to create member' });
  }
});

// PUT /api/agent/members/:id
router.put('/members/:id', async (req, res) => {
  try {
    const detail = await updateAgentMember({
      agentId: req.user._id,
      memberId: req.params.id,
      payload: req.body
    });

    await createAuditLog(req.user._id, 'UPDATE_MEMBER', detail.member.id, {
      username: detail.member.username,
      name: detail.member.name,
      memberCode: detail.member.memberCode
    });

    res.json(detail);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update member' });
  }
});

// GET /api/agent/customers
router.get('/customers', async (req, res) => {
  try {
    const members = await getAgentMembers({
      agentId: req.user._id,
      search: req.query.search || '',
      status: req.query.status || '',
      online: req.query.online || ''
    });

    res.json(members.map((member) => ({
      _id: member.id,
      username: member.username,
      name: member.name,
      memberCode: member.memberCode,
      phone: member.phone,
      isActive: member.isActive,
      status: member.status,
      isOnline: member.isOnline,
      creditBalance: member.creditBalance,
      stockPercent: member.stockPercent,
      lastActiveAt: member.lastActiveAt,
      totalBets: member.totals.totalBets,
      totalAmount: member.totals.totalAmount,
      totalWon: member.totals.totalWon
    })));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agent/customers
router.post('/customers', async (req, res) => {
  try {
    const detail = await createAgentMember({
      agentId: req.user._id,
      payload: req.body
    });

    await createAuditLog(req.user._id, 'CREATE_CUSTOMER', detail.member.id, { name: detail.member.name });
    res.status(201).json(detail.member);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Server error' });
  }
});

// PUT /api/agent/customers/:id
router.put('/customers/:id', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      status: req.body.status || (req.body.isActive === false ? 'inactive' : req.body.isActive === true ? 'active' : undefined)
    };

    const detail = await updateAgentMember({
      agentId: req.user._id,
      memberId: req.params.id,
      payload
    });

    await createAuditLog(req.user._id, 'UPDATE_CUSTOMER', detail.member.id, { name: detail.member.name });
    res.json(detail.member);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Server error' });
  }
});

// DELETE /api/agent/customers/:id
router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await deactivateAgentMember({
      agentId: req.user._id,
      memberId: req.params.id
    });

    await createAuditLog(req.user._id, 'DEACTIVATE_CUSTOMER', customer._id.toString(), { name: customer.name });
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(404).json({ message: error.message || 'Server error' });
  }
});

// GET /api/agent/bets
router.get('/bets', async (req, res) => {
  try {
    const { roundDate, customerId, marketId } = req.query;
    const bets = await listAgentBetItems({
      agentId: req.user._id,
      roundDate,
      customerId,
      marketId
    });

    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/reports
router.get('/reports', async (req, res) => {
  try {
    const { roundDate, marketId, customerId, startDate, endDate, legacy } = req.query;
    const report = await getAgentReportsBundle({
      agentId: req.user._id,
      roundDate,
      marketId,
      customerId,
      startDate,
      endDate
    });

    res.json(legacy === '1' ? report.legacyRows : report);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
