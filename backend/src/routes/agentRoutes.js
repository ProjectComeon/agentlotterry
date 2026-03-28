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
  getAgentReportsBundle
} = require('../services/analyticsService');
const {
  getAgentMemberBootstrap,
  getAgentMembers,
  getAgentMemberDetail,
  createAgentMember,
  updateAgentMember,
  deactivateAgentMember,
  isUserOnline
} = require('../services/memberManagementService');

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
