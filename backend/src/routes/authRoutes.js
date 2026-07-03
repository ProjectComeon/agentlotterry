const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { createAuditLog } = require('../middleware/auditLog');
const { loginRateLimit, resetLoginRateLimit } = require('../middleware/loginRateLimit');
const { canAuthenticateAccount, getAccountAccessMessage } = require('../utils/accountAccess');
const { clearAuthCookies, setAuthCookies } = require('../utils/httpCookies');

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const { password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!canAuthenticateAccount(user)) {
      return res.status(403).json({ message: getAccountAccessMessage(user) || 'Account is deactivated' });
    }

    if (user.role === 'customer') {
      return res.status(403).json({ message: 'บัญชีนี้ไม่มีสิทธิ์เข้าสู่ระบบ' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await createAuditLog(user._id, 'LOGIN', 'auth', { ip: req.ip });
    resetLoginRateLimit(req);
    const csrfToken = setAuthCookies(res, token);
    const payload = {
      csrfToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        displayRole: user.displayRole || (user.role === 'customer' ? 'member' : user.role),
        phone: user.phone,
        creditBalance: user.creditBalance,
        stockPercent: user.stockPercent,
        ownerPercent: user.ownerPercent,
        keepPercent: user.keepPercent,
        commissionRate: user.commissionRate,
        status: user.status,
        defaultRateProfileId: user.defaultRateProfileId,
        lastActiveAt: user.lastActiveAt
      }
    };

    if (req.get('X-Allow-Bearer-Response') === '1') {
      payload.token = token;
    }

    res.json(payload);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    clearAuthCookies(res);
    await createAuditLog(req.user._id, 'LOGOUT', 'auth', { ip: req.ip });
    res.json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
