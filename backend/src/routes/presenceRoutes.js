const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.use(auth);

router.post('/heartbeat', async (req, res) => {
  try {
    const timestamp = new Date();
    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          lastActiveAt: timestamp,
          status: 'active'
        }
      }
    );

    res.json({
      ok: true,
      lastActiveAt: timestamp.toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update presence' });
  }
});

module.exports = router;
