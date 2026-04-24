const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');
const {
  listAgentBetItems,
  getAgentReportsBundle
} = require('../services/analyticsService');
const {
  getAgentMemberBootstrap,
  getAgentMembers,
  getAgentMemberDetail,
  createAgentMember,
  updateAgentMember,
  deactivateAgentMember
} = require('../services/memberManagementService');
const { clearCatalogOverviewCache, clearCatalogOverviewCacheForUsers } = require('../services/catalogService');
const { getAgentDashboardSummary } = require('../services/dashboardSnapshotService');
const { scheduleReadModelSnapshotRebuild } = require('../services/readModelSnapshotService');
const { registerBettingRoutes } = require('./helpers/registerBettingRoutes');
const { parsePaginationQuery } = require('../utils/pagination');

const router = express.Router();
const shouldIncludeTotals = (value) => !['0', 'false'].includes(String(value || '').trim().toLowerCase());

// All agent routes require auth + agent role
router.use(auth, authorize('agent'));

registerBettingRoutes(router, {
  buildMemberTotalsParams: (req, member) => ({
    agentId: req.user._id,
    customerId: member._id
  }),
  createSlipAuditActions: {
    draft: 'AGENT_CREATE_DRAFT_SLIP_FOR_MEMBER',
    submit: 'AGENT_CREATE_MEMBER_SLIP'
  },
  cancelSlipOptions: {
    allowCancel: true,
    auditAction: 'AGENT_CANCEL_MEMBER_SLIP'
  }
});

// GET /api/agent/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    res.json(await getAgentDashboardSummary({ agent: req.user }));
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
    await clearCatalogOverviewCacheForUsers({ userIds: [detail.member.id] });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({
      reason: 'agent-member-lottery-config-update',
      agentIds: [req.user._id]
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
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 24 });
    const members = await getAgentMembers({
      agentId: req.user._id,
      search: req.query.search || '',
      status: req.query.status || '',
      online: req.query.online || '',
      includeTotals: shouldIncludeTotals(req.query.includeTotals),
      ...pagination
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
      name: detail.member.name
    });
    scheduleReadModelSnapshotRebuild({ reason: 'agent-member-create', agentIds: [req.user._id] });

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
      name: detail.member.name
    });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({ reason: 'agent-member-update', agentIds: [req.user._id] });

    res.json(detail);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update member' });
  }
});

// GET /api/agent/customers
router.get('/customers', async (req, res) => {
  try {
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 24 });
    const members = await getAgentMembers({
      agentId: req.user._id,
      search: req.query.search || '',
      status: req.query.status || '',
      online: req.query.online || '',
      includeTotals: shouldIncludeTotals(req.query.includeTotals),
      ...pagination
    });

    const mapCustomerRow = (member) => ({
      _id: member.id,
      username: member.username,
      name: member.name,
      phone: member.phone,
      isActive: member.isActive,
      status: member.status,
      isOnline: member.isOnline,
      creditBalance: member.creditBalance,
      stockPercent: member.stockPercent,
      lastActiveAt: member.lastActiveAt,
      totalBets: member.totals?.totalBets || 0,
      totalAmount: member.totals?.totalAmount || 0,
      totalWon: member.totals?.totalWon || 0
    });

    if (pagination.paginated) {
      return res.json({
        items: (members.items || []).map(mapCustomerRow),
        pagination: members.pagination
      });
    }

    res.json(members.map(mapCustomerRow));
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
    scheduleReadModelSnapshotRebuild({ reason: 'agent-customer-create', agentIds: [req.user._id] });
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
    await clearCatalogOverviewCacheForUsers({ userIds: [detail.member.id] });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({ reason: 'agent-customer-update', agentIds: [req.user._id] });
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
    await clearCatalogOverviewCacheForUsers({ userIds: [customer._id] });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({ reason: 'agent-customer-deactivate', agentIds: [req.user._id] });
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(404).json({ message: error.message || 'Server error' });
  }
});

// GET /api/agent/bets
router.get('/bets', async (req, res) => {
  try {
    const { roundDate, customerId, marketId, summary } = req.query;
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 10 });
    const bets = await listAgentBetItems({
      agentId: req.user._id,
      roundDate,
      customerId,
      marketId,
      summary: summary === '1',
      ...pagination
    });

    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/reports
router.get('/reports', async (req, res) => {
  try {
    const { roundDate, marketId, customerId, startDate, endDate, legacy, sections } = req.query;
    const report = await getAgentReportsBundle({
      agentId: req.user._id,
      roundDate,
      marketId,
      customerId,
      startDate,
      endDate,
      sections: legacy === '1' ? undefined : sections
    });

    res.json(legacy === '1' ? report.legacyRows : report);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
