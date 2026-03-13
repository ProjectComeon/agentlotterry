const express = require('express');
const Bet = require('../models/Bet');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { PAY_RATES } = require('../services/calculationService');
const { createAuditLog } = require('../middleware/auditLog');

const router = express.Router();

// All customer routes require auth + customer role
router.use(auth, authorize('customer'));

// POST /api/customer/bets - แทงเลข
router.post('/bets', async (req, res) => {
  try {
    const { bets } = req.body; // Array of { betType, number, amount }

    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ message: 'Bets array is required' });
    }

    const customer = await User.findById(req.user._id);
    if (!customer.agentId) {
      return res.status(400).json({ message: 'Customer has no agent assigned' });
    }

    // Get current round date (1st or 16th of month)
    const now = new Date();
    const day = now.getDate();
    let roundDate;
    if (day <= 16) {
      roundDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-16`;
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      roundDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const validBetTypes = Object.keys(PAY_RATES);
    const createdBets = [];

    for (const bet of bets) {
      const { betType, number, amount } = bet;

      // Validate bet type
      if (!validBetTypes.includes(betType)) {
        return res.status(400).json({ message: `Invalid bet type: ${betType}` });
      }

      // Validate number length
      const numberStr = String(number).trim();
      if (betType.startsWith('3') && numberStr.length !== 3) {
        return res.status(400).json({ message: '3-digit bet requires exactly 3 digits' });
      }
      if (betType.startsWith('2') && numberStr.length !== 2) {
        return res.status(400).json({ message: '2-digit bet requires exactly 2 digits' });
      }
      if (betType.startsWith('run') && numberStr.length !== 1) {
        return res.status(400).json({ message: 'Run bet requires exactly 1 digit' });
      }

      // Validate amount
      if (!amount || amount < 1) {
        return res.status(400).json({ message: 'Amount must be at least 1' });
      }

      const payRate = PAY_RATES[betType];

      const newBet = await Bet.create({
        customerId: req.user._id,
        agentId: customer.agentId,
        roundDate,
        betType,
        number: numberStr,
        amount,
        payRate
      });

      createdBets.push(newBet);
    }

    await createAuditLog(req.user._id, 'CREATE_BET', '', { 
      count: createdBets.length, 
      roundDate 
    });

    res.status(201).json({
      message: `Successfully placed ${createdBets.length} bet(s)`,
      bets: createdBets,
      roundDate
    });
  } catch (error) {
    console.error('Create bet error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/customer/bets - ประวัติการแทง
router.get('/bets', async (req, res) => {
  try {
    const { roundDate, result } = req.query;
    const filter = { customerId: req.user._id };
    if (roundDate) filter.roundDate = roundDate;
    if (result) filter.result = result;

    const bets = await Bet.find(filter).sort({ createdAt: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/customer/summary - สรุปได้เสีย
router.get('/summary', async (req, res) => {
  try {
    const { roundDate } = req.query;
    const matchFilter = { customerId: req.user._id };
    if (roundDate) matchFilter.roundDate = roundDate;

    const summary = await Bet.aggregate([
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
        netResult: { $subtract: ['$totalWon', '$totalAmount'] },
        betCount: 1,
        wonCount: 1,
        lostCount: 1,
        pendingCount: 1
      }},
      { $sort: { roundDate: -1 } }
    ]);

    // Overall totals
    const overall = await Bet.aggregate([
      { $match: { customerId: req.user._id } },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalWon: { $sum: '$wonAmount' },
        betCount: { $sum: 1 }
      }}
    ]);

    res.json({
      rounds: summary,
      overall: {
        totalAmount: overall[0]?.totalAmount || 0,
        totalWon: overall[0]?.totalWon || 0,
        netResult: (overall[0]?.totalWon || 0) - (overall[0]?.totalAmount || 0),
        totalBets: overall[0]?.betCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
