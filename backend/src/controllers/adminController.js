const { SessionService } = require('../services');
const { User } = require('../models');
const { ApiResponse } = require('../utils');

class AdminController {
  // Get all active sessions (admin only)
  static async getAllSessions(req, res) {
    try {
      const { page = 1, limit = 20, userId } = req.query;
      
      const result = await SessionService.getAllSessions({
        page: parseInt(page),
        limit: parseInt(limit),
        userId
      });
      
      return ApiResponse.success(res, {
        sessions: result.sessions.map(session => ({
          id: session._id,
          user: session.user ? {
            id: session.user._id,
            email: session.user.email,
            name: session.user.name,
            role: session.user.role
          } : null,
          deviceName: session.deviceName,
          browser: session.browser,
          os: session.os,
          ipAddress: session.ipAddress,
          country: session.country,
          city: session.city,
          isSuspicious: session.isSuspicious,
          suspiciousReason: session.suspiciousReason,
          isVerified: session.isVerified,
          createdAt: session.createdAt,
          lastUsedAt: session.lastUsedAt
        })),
        pagination: result.pagination
      });
      
    } catch (error) {
      console.error('Admin get sessions error:', error);
      return ApiResponse.error(res, 'Failed to get sessions', 500);
    }
  }

  // Force logout a specific user (admin only)
  static async forceLogoutUser(req, res) {
    try {
      const { userId } = req.params;
      
      // Check if target user exists
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return ApiResponse.notFound(res, 'User not found');
      }
      
      // Prevent admin from force logging out themselves
      if (userId === req.user._id.toString()) {
        return ApiResponse.error(res, 'Cannot force logout yourself', 400);
      }
      
      await SessionService.adminForceLogout(userId, req.user._id, 'Admin force logout');
      
      return ApiResponse.success(res, null, `User ${targetUser.email} has been logged out from all devices`);
      
    } catch (error) {
      console.error('Admin force logout error:', error);
      return ApiResponse.error(res, 'Failed to force logout user', 500);
    }
  }

  // Revoke specific session (admin only)
  static async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      const session = await SessionService.adminRevokeSession(
        sessionId, 
        req.user._id, 
        'Admin revoked session'
      );
      
      return ApiResponse.success(res, {
        session: {
          id: session._id,
          isRevoked: session.isRevoked
        }
      }, 'Session revoked successfully');
      
    } catch (error) {
      console.error('Admin revoke session error:', error);
      
      if (error.message === 'Session not found') {
        return ApiResponse.notFound(res, 'Session not found');
      }
      
      return ApiResponse.error(res, 'Failed to revoke session', 500);
    }
  }

  // Get all users (admin only)
  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { Session } = require('../models');
      
      const users = await User.find()
        .select('-password -tokenVersion')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
      
      const total = await User.countDocuments();
      
      // Get session counts for each user
      const userIds = users.map(u => u._id);
      const sessionCounts = await Session.aggregate([
        { 
          $match: { 
            user: { $in: userIds },
            isRevoked: false,
            expiresAt: { $gt: new Date() }
          }
        },
        { $group: { _id: '$user', count: { $sum: 1 } } }
      ]);
      
      const sessionCountMap = new Map(
        sessionCounts.map(s => [s._id.toString(), s.count])
      );
      
      return ApiResponse.success(res, {
        users: users.map(user => ({
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          sessionCount: sessionCountMap.get(user._id.toString()) || 0
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
      
    } catch (error) {
      console.error('Admin get users error:', error);
      return ApiResponse.error(res, 'Failed to get users', 500);
    }
  }
}

module.exports = AdminController;
