const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');
const {
  getBetTotals,
  getRecentBetItems,
  getTotalsGroupedByField,
  getAgentReportRows
} = require('../services/analyticsService');

const router = express.Router();

// All admin routes require auth + admin role
router.use(auth, authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalAgents,
      totalCustomers,
      activeAgents,
      activeCustomers,
      betStats,
      recentBets
    ] = await Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'agent', isActive: true }),
      User.countDocuments({ role: 'customer', isActive: true }),
      getBetTotals(),
      getRecentBetItems({ limit: 10 })
    ]);

    res.json({
      stats: {
        totalAgents,
        totalCustomers,
        activeAgents,
        activeCustomers,
        totalBets: betStats.totalBets,
        pendingBets: betStats.pendingBets,
        totalAmount: betStats.totalAmount,
        totalWon: betStats.totalWon,
        netProfit: betStats.netProfit
      },
      recentBets
    });
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
    const { username, password, name, phone } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ message: 'Username, password, and name are required' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const agent = await User.create({
      username,
      password,
      role: 'agent',
      name,
      phone: phone || ''
    });

    await createAuditLog(req.user._id, 'CREATE_AGENT', agent._id.toString(), { name });
    res.status(201).json(agent);
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/agents/:id
router.put('/agents/:id', async (req, res) => {
  try {
    const { name, phone, isActive, password } = req.body;
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (name) agent.name = name;
    if (phone !== undefined) agent.phone = phone;
    if (isActive !== undefined) agent.isActive = isActive;
    if (password) agent.password = password;

    await agent.save();
    await createAuditLog(req.user._id, 'UPDATE_AGENT', agent._id.toString(), { name });
    res.json(agent);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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
    res.json({ message: 'Agent deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/customers
router.get('/customers', async (req, res) => {
  try {
    const { agentId } = req.query;
    const filter = { role: 'customer' };
    if (agentId) filter.agentId = agentId;

    const customers = await User.find(filter)
      .select('-password')
      .populate('agentId', 'name username')
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/customers
router.post('/customers', async (req, res) => {
  try {
    const { username, password, name, phone, agentId } = req.body;

    if (!username || !password || !name || !agentId) {
      return res.status(400).json({ message: 'Username, password, name, and agentId are required' });
    }

    const agent = await User.findOne({ _id: agentId, role: 'agent' });
    if (!agent) {
      return res.status(400).json({ message: 'Agent not found' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const customer = await User.create({
      username,
      password,
      role: 'customer',
      name,
      phone: phone || '',
      agentId
    });

    await createAuditLog(req.user._id, 'CREATE_CUSTOMER', customer._id.toString(), { name, agentId });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/customers/:id
router.put('/customers/:id', async (req, res) => {
  try {
    const { name, phone, isActive, password, agentId } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (isActive !== undefined) customer.isActive = isActive;
    if (password) customer.password = password;
    if (agentId) customer.agentId = agentId;

    await customer.save();
    await createAuditLog(req.user._id, 'UPDATE_CUSTOMER', customer._id.toString(), { name });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/reports
router.get('/reports', async (req, res) => {
  try {
    const { roundDate, startDate, endDate, marketId } = req.query;
    const report = await getAgentReportRows({
      roundDate,
      startDate,
      endDate,
      marketId
    });

    res.json(report);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
