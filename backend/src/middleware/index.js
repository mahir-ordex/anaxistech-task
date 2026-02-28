const { protect, optionalAuth, requireRole, adminOnly } = require('./auth');
const validation = require('./validation');
const rateLimiter = require('./rateLimiter');

module.exports = {
  protect,
  optionalAuth,
  requireRole,
  adminOnly,
  ...validation,
  ...rateLimiter
};
