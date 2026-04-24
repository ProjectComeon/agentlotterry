const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');
const {
  getTotalsGroupedByField,
  getAgentReportRows,
  getAdminReportsBundle,
  listAgentBetItems
} = require('../services/analyticsService');
const {
  createAdminMember,
  getAdminMemberBootstrap,
  getAdminMemberDetail,
  listAdminCustomers,
  updateAdminMember
} = require('../services/memberManagementService');
const { clearCatalogOverviewCache, clearCatalogOverviewCacheForUsers } = require('../services/catalogService');
const { getAdminDashboardSummary } = require('../services/dashboardSnapshotService');
const { scheduleReadModelSnapshotRebuild } = require('../services/readModelSnapshotService');
const { registerBettingRoutes } = require('./helpers/registerBettingRoutes');
const { parsePaginationQuery } = require('../utils/pagination');

const router = express.Router();
const shouldIncludeTotals = (value) => !['0', 'false'].includes(String(value || '').trim().toLowerCase());

// All admin routes require auth + admin role
router.use(auth, authorize('admin'));

const AGENT_STATUS_OPTIONS = ['active', 'inactive', 'suspended'];

const normalizePercent = (value, label, { fallback, allowUndefined = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return allowUndefined ? undefined : fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be between 0 and 100`);
  }

  return parsed;
};

const normalizeAgentStatus = (value, { fallback, allowUndefined = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return allowUndefined ? undefined : fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!AGENT_STATUS_OPTIONS.includes(normalized)) {
    throw new Error('Invalid agent status');
  }

  return normalized;
};

const buildAgentPayload = (body = {}, { isCreate = false } = {}) => {
  const payload = {};

  if (isCreate || body.username !== undefined) {
    const username = String(body.username || '').trim().toLowerCase();
    if (!username) throw new Error('Username is required');
    payload.username = username;
  }

  if (isCreate || body.password !== undefined) {
    const password = String(body.password || '');
    if (isCreate && !password) throw new Error('Password is required');
    if (password) payload.password = password;
  }

  if (isCreate || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new Error('Name is required');
    payload.name = name;
  }

  if (isCreate || body.phone !== undefined) {
    payload.phone = String(body.phone || '').trim();
  }

  if (isCreate || body.notes !== undefined) {
    payload.notes = String(body.notes || '').trim();
  }

  const status = normalizeAgentStatus(body.status, { fallback: 'active', allowUndefined: !isCreate });
  if (status !== undefined) {
    payload.status = status;
    payload.isActive = status !== 'inactive';
  } else if (body.isActive !== undefined) {
    const isActive = body.isActive === true || body.isActive === 'true';
    payload.isActive = isActive;
    payload.status = isActive ? 'active' : 'inactive';
  }

  const stockPercent = normalizePercent(body.stockPercent, 'Stock percent', { fallback: 0, allowUndefined: !isCreate });
  if (stockPercent !== undefined) payload.stockPercent = stockPercent;

  const ownerPercent = normalizePercent(body.ownerPercent, 'Owner percent', { fallback: 0, allowUndefined: !isCreate });
  if (ownerPercent !== undefined) payload.ownerPercent = ownerPercent;

  const keepPercent = normalizePercent(body.keepPercent, 'Keep percent', { fallback: 0, allowUndefined: !isCreate });
  if (keepPercent !== undefined) payload.keepPercent = keepPercent;

  const commissionRate = normalizePercent(body.commissionRate, 'Commission rate', { fallback: 0, allowUndefined: !isCreate });
  if (commissionRate !== undefined) payload.commissionRate = commissionRate;

  return payload;
};

registerBettingRoutes(router, {
  includeMemberAgentId: true,
  buildSearchParams: (req) => ({
    agentId: req.query.agentId || ''
  }),
  buildMemberTotalsParams: (req, member) => ({
    customerId: member._id
  }),
  createSlipAuditActions: {
    draft: 'ADMIN_CREATE_DRAFT_SLIP_FOR_MEMBER',
    submit: 'ADMIN_CREATE_MEMBER_SLIP'
  },
  cancelSlipOptions: {
    allowCancel: true,
    auditAction: 'ADMIN_CANCEL_MEMBER_SLIP'
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    res.json(await getAdminDashboardSummary());
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/agents
router.get('/agents', async (req, res) => {
  try {
    const [agents, customerRows, betStatsByAgent] = await Promise.all([
      User.find({ role: 'agent' }).select('-password').sort({ createdAt: -1 }),
      User.aggregate([
        { $match: { role: 'customer', agentId: { $ne: null } } },
        {
          $group: {
            _id: '$agentId',
            customerCount: { $sum: 1 }
          }
        }
      ]),
      getTotalsGroupedByField('agentId')
    ]);

    const customerCountMap = customerRows.reduce((acc, row) => {
      if (row._id) {
        acc[row._id.toString()] = row.customerCount;
      }
      return acc;
    }, {});

    const agentsWithStats = agents.map((agent) => {
      const stat = betStatsByAgent[agent._id.toString()] || {};

      return {
        ...agent.toJSON(),
        customerCount: customerCountMap[agent._id.toString()] || 0,
        totalBets: stat.count || 0,
        totalAmount: stat.totalAmount || 0,
        totalWon: stat.totalWon || 0
      };
    });

    res.json(agentsWithStats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/agents
router.post('/agents', async (req, res) => {
  try {
    const payload = buildAgentPayload(req.body, { isCreate: true });

    const existing = await User.findOne({ username: payload.username });
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const agent = await User.create({
      role: 'agent',
      ...payload
    });

    await createAuditLog(req.user._id, 'CREATE_AGENT', agent._id.toString(), {
      username: agent.username,
      name: agent.name,
      status: agent.status
    });
    scheduleReadModelSnapshotRebuild({ reason: 'admin-agent-create', includeAgents: true });
    res.status(201).json(agent);
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(400).json({ message: error.message || 'Failed to create agent' });
  }
});

// PUT /api/admin/agents/:id
router.put('/agents/:id', async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const payload = buildAgentPayload(req.body);
    Object.assign(agent, payload);

    await agent.save();
    await createAuditLog(req.user._id, 'UPDATE_AGENT', agent._id.toString(), {
      username: agent.username,
      name: agent.name,
      status: agent.status
    });
    scheduleReadModelSnapshotRebuild({ reason: 'admin-agent-update', agentIds: [agent._id] });
    res.json(agent);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update agent' });
  }
});

// DELETE /api/admin/agents/:id
router.delete('/agents/:id', async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Deactivate instead of delete
    agent.isActive = false;
    await agent.save();

    // Also deactivate all customers under this agent
    await User.updateMany({ agentId: agent._id }, { isActive: false });

    await createAuditLog(req.user._id, 'DEACTIVATE_AGENT', agent._id.toString(), { name: agent.name });
    scheduleReadModelSnapshotRebuild({ reason: 'admin-agent-deactivate', includeAgents: true });
    res.json({ message: 'Agent deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/customers
router.get('/customers', async (req, res) => {
  try {
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 24 });
    const customers = await listAdminCustomers({
      agentId: req.query.agentId || '',
      search: req.query.search || '',
      status: req.query.status || '',
      sortBy: req.query.sortBy || 'recent',
      includeTotals: shouldIncludeTotals(req.query.includeTotals),
      ...pagination
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/customers/bootstrap
router.get('/customers/bootstrap', async (req, res) => {
  try {
    const bootstrap = await getAdminMemberBootstrap({ agentId: req.query.agentId || '' });
    res.json(bootstrap);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load member bootstrap' });
  }
});

// GET /api/admin/customers/:id
router.get('/customers/:id', async (req, res) => {
  try {
    const detail = await getAdminMemberDetail({ memberId: req.params.id });
    res.json(detail);
  } catch (error) {
    res.status(404).json({ message: error.message || 'Customer not found' });
  }
});

// POST /api/admin/customers
router.post('/customers', async (req, res) => {
  try {
    const detail = await createAdminMember({
      payload: req.body
    });

    await createAuditLog(req.user._id, 'CREATE_CUSTOMER', detail.member.id, {
      username: detail.member.username,
      name: detail.member.name,
      agentId: detail.member.agentId
    });
    scheduleReadModelSnapshotRebuild({
      reason: 'admin-customer-create',
      agentIds: detail.member.agentId ? [detail.member.agentId] : [],
      includeAgents: !detail.member.agentId
    });

    res.status(201).json(detail);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to create customer' });
  }
});

// PUT /api/admin/customers/:id
router.put('/customers/:id', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      profile: req.body.profile || {},
      agentId:
        req.body.agentId ||
        req.body.account?.agentId ||
        req.body.profile?.agentId ||
        undefined
    };

    if (req.body.isActive !== undefined && payload.profile.status === undefined) {
      payload.profile.status = req.body.isActive ? 'active' : 'inactive';
    }

    const detail = await updateAdminMember({
      memberId: req.params.id,
      payload
    });

    await createAuditLog(req.user._id, 'UPDATE_CUSTOMER', detail.member.id, {
      username: detail.member.username,
      name: detail.member.name,
      agentId: detail.member.agentId
    });
    await clearCatalogOverviewCacheForUsers({ userIds: [detail.member.id] });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({
      reason: 'admin-customer-update',
      agentIds: detail.member.agentId ? [detail.member.agentId] : [],
      includeAgents: !detail.member.agentId
    });

    res.json(detail);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update customer' });
  }
});

// DELETE /api/admin/customers/:id
router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.isActive = false;
    await customer.save();

    await createAuditLog(req.user._id, 'DEACTIVATE_CUSTOMER', customer._id.toString(), { name: customer.name });
    await clearCatalogOverviewCacheForUsers({ userIds: [customer._id] });
    clearCatalogOverviewCache({ includeSnapshots: false });
    scheduleReadModelSnapshotRebuild({
      reason: 'admin-customer-deactivate',
      agentIds: customer.agentId ? [customer.agentId] : [],
      includeAgents: !customer.agentId
    });
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/reports
router.get('/reports', async (req, res) => {
  try {
    const { roundDate, startDate, endDate, marketId, agentId, limit, sections, bundle } = req.query;
    if (bundle === '1') {
      const reportBundle = await getAdminReportsBundle({
        roundDate,
        startDate,
        endDate,
        marketId,
        agentId,
        limit,
        sections
      });

      return res.json(reportBundle);
    }

    const report = await getAgentReportRows({
      roundDate,
      startDate,
      endDate,
      marketId,
      agentId,
      limit
    });

    res.json(report);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/bets
router.get('/bets', async (req, res) => {
  try {
    const { roundDate, customerId, marketId, agentId, summary } = req.query;
    const pagination = parsePaginationQuery(req.query, { defaultLimit: 10 });
    const bets = await listAgentBetItems({
      roundDate,
      customerId,
      marketId,
      agentId,
      summary: summary === '1',
      ...pagination
    });

    res.json(bets);
  } catch (error) {
    console.error('Admin bets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
