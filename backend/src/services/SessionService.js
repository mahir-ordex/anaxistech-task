const { Session, User } = require('../models');

class SessionService {
  // Get all active sessions for a user
  static async getUserSessions(userId) {
    const sessions = await Session.find({
      user: userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    })
    .select('-refreshTokenFamily -verificationToken')
    .sort({ lastUsedAt: -1 });
    
    return sessions;
  }

  // Get a specific session
  static async getSession(sessionId, userId) {
    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
      isRevoked: false
    }).select('-refreshTokenHash -refreshTokenFamily -verificationToken');
    
    return session;
  }

  // Revoke a specific session
  static async revokeSession(sessionId, userId, reason = 'Manual logout') {
    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
      isRevoked: false
    });
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    await session.revoke(reason);
    return session;
  }

  // Revoke all sessions for a user
  static async revokeAllSessions(userId, reason = 'Logout all devices') {
    const result = await Session.revokeAllUserSessions(userId, reason);
    return result;
  }

  // Revoke all sessions except current
  static async revokeOtherSessions(userId, currentRefreshToken, reason = 'Logout other devices') {
    const currentHash = Session.hashToken(currentRefreshToken);
    
    await Session.updateMany(
      { 
        user: userId, 
        isRevoked: false,
        refreshTokenHash: { $ne: currentHash }
      },
      { 
        isRevoked: true, 
        revokedAt: new Date(),
        revokedReason: reason
      }
    );
  }

  // Admin: Get all active sessions (all users)
  static async getAllSessions(options = {}) {
    const { page = 1, limit = 20, userId } = options;
    
    const query = {
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    };
    
    if (userId) {
      query.user = userId;
    }
    
    const sessions = await Session.find(query)
      .populate('user', 'email name role')
      .select('-refreshTokenHash -refreshTokenFamily -verificationToken')
      .sort({ lastUsedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Session.countDocuments(query);
    
    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Admin: Force logout a user
  static async adminForceLogout(targetUserId, adminId, reason = 'Admin force logout') {
    // Increment user's token version
    const user = await User.findById(targetUserId);
    if (!user) {
      throw new Error('User not found');
    }
    
    await user.incrementTokenVersion();
    await Session.revokeAllUserSessions(targetUserId, `${reason} by admin: ${adminId}`);
    
    return true;
  }

  // Admin: Revoke specific session
  static async adminRevokeSession(sessionId, adminId, reason = 'Admin revoked session') {
    const session = await Session.findOne({
      _id: sessionId,
      isRevoked: false
    });
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    await session.revoke(`${reason} by admin: ${adminId}`);
    return session;
  }

  // Get session statistics for a user
  static async getSessionStats(userId) {
    const activeSessions = await Session.countDocuments({
      user: userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    });
    
    const suspiciousSessions = await Session.countDocuments({
      user: userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
      isSuspicious: true,
      isVerified: false
    });
    
    return {
      activeSessions,
      suspiciousSessions,
      maxSessions: parseInt(process.env.MAX_SESSIONS_PER_USER) || 3
    };
  }
}

module.exports = SessionService;
