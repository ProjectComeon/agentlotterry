const express = require('express');
const User = require('../models/User');
const Bet = require('../models/Bet');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

// All admin routes require auth + admin role
router.use(auth, authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const activeAgents = await User.countDocuments({ role: 'agent', isActive: true });
    const activeCustomers = await User.countDocuments({ role: 'customer', isActive: true });
    
    const totalBets = await Bet.countDocuments();
    const pendingBets = await Bet.countDocuments({ result: 'pending' });
    
    const betSummary = await Bet.aggregate([
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        count: { $sum: 1 }
      }}
    ]);

    const recentBets = await Bet.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customerId', 'name username')
      .populate('agentId', 'name username');

    res.json({
      stats: {
        totalAgents,
        totalCustomers,
        activeAgents,
        activeCustomers,
        totalBets,
        pendingBets,
        totalAmount: betSummary[0]?.totalAmount || 0,
        totalWon: betSummary[0]?.totalWon || 0,
        netProfit: (betSummary[0]?.totalAmount || 0) - (betSummary[0]?.totalWon || 0)
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
    const agents = await User.find({ role: 'agent' }).select('-password').sort({ createdAt: -1 });
    
    // Get customer count for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const customerCount = await User.countDocuments({ agentId: agent._id, role: 'customer' });
        const betStats = await Bet.aggregate([
          { $match: { agentId: agent._id } },
          { $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalWon: { $sum: '$wonAmount' },
            count: { $sum: 1 }
          }}
        ]);
        return {
          ...agent.toJSON(),
          customerCount,
          totalBets: betStats[0]?.count || 0,
          totalAmount: betStats[0]?.totalAmount || 0,
          totalWon: betStats[0]?.totalWon || 0
        };
      })
    );

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
    const { roundDate, startDate, endDate } = req.query;
    
    let matchFilter = {};
    if (roundDate) {
      matchFilter.roundDate = roundDate;
    } else if (startDate && endDate) {
      matchFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const report = await Bet.aggregate([
      { $match: matchFilter },
      { $group: {
        _id: { roundDate: '$roundDate', agentId: '$agentId' },
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        betCount: { $sum: 1 },
        wonCount: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostCount: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id.agentId',
        foreignField: '_id',
        as: 'agent'
      }},
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      { $project: {
        roundDate: '$_id.roundDate',
        agentName: '$agent.name',
        agentUsername: '$agent.username',
        totalAmount: 1,
        totalWon: 1,
        netProfit: { $subtract: ['$totalAmount', '$totalWon'] },
        betCount: 1,
        wonCount: 1,
        lostCount: 1,
        pendingCount: 1
      }},
      { $sort: { roundDate: -1 } }
    ]);

    res.json(report);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
