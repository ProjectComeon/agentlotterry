const AuditLog = require('../models/AuditLog');

const createAuditLog = async (userId, action, target = '', details = {}, ip = '') => {
  try {
    await AuditLog.create({ userId, action, target, details, ip });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

const auditMiddleware = (action) => {
  return (req, res, next) => {
    const originalSend = res.json.bind(res);
    
    res.json = function(data) {
      if (res.statusCode < 400 && req.user) {
        const ip = req.ip || req.connection?.remoteAddress || '';
        createAuditLog(req.user._id, action, req.originalUrl, {
          method: req.method,
          body: req.method !== 'GET' ? req.body : undefined
        }, ip);
      }
      return originalSend(data);
    };
    
    next();
  };
};

module.exports = { createAuditLog, auditMiddleware };
