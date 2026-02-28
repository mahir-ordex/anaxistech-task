const { verifyAccessToken } = require('../utils');
const { User, Session } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

// Protect routes - verify access token
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token required');
    }
    
    // Verify token
    const verification = verifyAccessToken(token);
    
    if (!verification.valid) {
      return ApiResponse.unauthorized(res, 'Invalid or expired access token');
    }
    
    // Get user from database
    const user = await User.findById(verification.decoded.userId);
    
    if (!user) {
      return ApiResponse.unauthorized(res, 'User not found');
    }
    
    // Check token version matches (for forced logout)
    if (user.tokenVersion !== verification.decoded.tokenVersion) {
      return ApiResponse.unauthorized(res, 'Session expired. Please login again.');
    }
    
    // Attach user to request
    req.user = user;
    req.tokenVersion = verification.decoded.tokenVersion;
    
    // Get current session hash for identifying current session
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      req.currentSessionHash = Session.hashToken(refreshToken);
      
      // Update lastUsedAt (throttled - only update if last update was > 5 minutes ago)
      // This runs async and doesn't block the request
      const sessionHash = req.currentSessionHash;
      Session.findOne({ refreshTokenHash: sessionHash, isRevoked: false })
        .then(session => {
          if (session) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (!session.lastUsedAt || session.lastUsedAt < fiveMinutesAgo) {
              Session.updateLastUsed(sessionHash).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return ApiResponse.unauthorized(res, 'Authentication failed');
  }
};

// Optional auth - doesn't fail if not authenticated
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return next();
    }
    
    const verification = verifyAccessToken(token);
    
    if (verification.valid) {
      const user = await User.findById(verification.decoded.userId);
      if (user && user.tokenVersion === verification.decoded.tokenVersion) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Require specific role(s)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }
    
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Insufficient permissions');
    }
    
    next();
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }
  
  if (req.user.role !== 'admin') {
    return ApiResponse.forbidden(res, 'Admin access required');
  }
  
  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireRole,
  adminOnly
};
