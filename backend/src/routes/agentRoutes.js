const express = require('express');
const User = require('../models/User');
const Bet = require('../models/Bet');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

// All agent routes require auth + agent role
router.use(auth, authorize('agent'));

// GET /api/agent/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const agentId = req.user._id;
    
    const totalCustomers = await User.countDocuments({ agentId, role: 'customer' });
    const activeCustomers = await User.countDocuments({ agentId, role: 'customer', isActive: true });
    
    const betStats = await Bet.aggregate([
      { $match: { agentId: agentId } },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        totalBets: { $sum: 1 },
        pendingBets: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }}
    ]);

    const recentBets = await Bet.find({ agentId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customerId', 'name username');

    res.json({
      stats: {
        totalCustomers,
        activeCustomers,
        totalBets: betStats[0]?.totalBets || 0,
        pendingBets: betStats[0]?.pendingBets || 0,
        totalAmount: betStats[0]?.totalAmount || 0,
        totalWon: betStats[0]?.totalWon || 0,
        netProfit: (betStats[0]?.totalAmount || 0) - (betStats[0]?.totalWon || 0)
      },
      recentBets
    });
  } catch (error) {
    console.error('Agent dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await User.find({ agentId: req.user._id, role: 'customer' })
      .select('-password')
      .sort({ createdAt: -1 });

    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const betStats = await Bet.aggregate([
          { $match: { customerId: customer._id } },
          { $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalWon: { $sum: '$wonAmount' },
            count: { $sum: 1 }
          }}
        ]);
        return {
          ...customer.toJSON(),
          totalBets: betStats[0]?.count || 0,
          totalAmount: betStats[0]?.totalAmount || 0,
          totalWon: betStats[0]?.totalWon || 0
        };
      })
    );

    res.json(customersWithStats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agent/customers
router.post('/customers', async (req, res) => {
  try {
    const { username, password, name, phone } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ message: 'Username, password, and name are required' });
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
      agentId: req.user._id
    });

    await createAuditLog(req.user._id, 'CREATE_CUSTOMER', customer._id.toString(), { name });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/agent/customers/:id
router.put('/customers/:id', async (req, res) => {
  try {
    const { name, phone, isActive, password } = req.body;
    const customer = await User.findOne({ 
      _id: req.params.id, 
      role: 'customer',
      agentId: req.user._id 
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (isActive !== undefined) customer.isActive = isActive;
    if (password) customer.password = password;

    await customer.save();
    await createAuditLog(req.user._id, 'UPDATE_CUSTOMER', customer._id.toString(), { name });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/agent/customers/:id
router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findOne({ 
      _id: req.params.id, 
      role: 'customer',
      agentId: req.user._id 
    });

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

// GET /api/agent/bets
router.get('/bets', async (req, res) => {
  try {
    const { roundDate, customerId } = req.query;
    const filter = { agentId: req.user._id };
    if (roundDate) filter.roundDate = roundDate;
    if (customerId) filter.customerId = customerId;

    const bets = await Bet.find(filter)
      .sort({ createdAt: -1 })
      .populate('customerId', 'name username');

    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/reports
router.get('/reports', async (req, res) => {
  try {
    const { roundDate } = req.query;
    const matchFilter = { agentId: req.user._id };
    if (roundDate) matchFilter.roundDate = roundDate;

    const report = await Bet.aggregate([
      { $match: matchFilter },
      { $group: {
        _id: '$roundDate',
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        betCount: { $sum: 1 },
        wonCount: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
        lostCount: { $sum: { $cond: [{ $eq: ['$result', 'lost'] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$result', 'pending'] }, 1, 0] } }
      }},
      { $project: {
        roundDate: '$_id',
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
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
