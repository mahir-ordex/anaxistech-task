const { SessionService } = require('../services');
const { ApiResponse } = require('../utils');

class SessionController {
  // Get all active sessions for current user
  static async getSessions(req, res) {
    try {
      const sessions = await SessionService.getUserSessions(req.user._id);
      const stats = await SessionService.getSessionStats(req.user._id);
      
      return ApiResponse.success(res, {
        sessions: sessions.map(session => ({
          id: session._id,
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
          lastUsedAt: session.lastUsedAt,
          isCurrent: session.refreshTokenHash === req.currentSessionHash
        })),
        stats
      });
      
    } catch (error) {
      console.error('Get sessions error:', error);
      return ApiResponse.error(res, 'Failed to get sessions', 500);
    }
  }

  // Revoke a specific session
  static async revokeSession(req, res) {
    try {
      const { id } = req.params;
      
      // Check if trying to revoke current session
      const { Session } = require('../models');
      const session = await Session.findOne({ _id: id, user: req.user._id, isRevoked: false });
      
      if (!session) {
        return ApiResponse.notFound(res, 'Session not found');
      }
      
      if (session.refreshTokenHash === req.currentSessionHash) {
        return ApiResponse.error(res, 'Cannot revoke current session. Use logout instead.', 400);
      }
      
      await SessionService.revokeSession(id, req.user._id, 'User logout from device');
      
      return ApiResponse.success(res, null, 'Session revoked successfully');
      
    } catch (error) {
      console.error('Revoke session error:', error);
      
      if (error.message === 'Session not found') {
        return ApiResponse.notFound(res, 'Session not found');
      }
      
      return ApiResponse.error(res, 'Failed to revoke session', 500);
    }
  }

  // Revoke all sessions
  static async revokeAllSessions(req, res) {
    try {
      await SessionService.revokeAllSessions(req.user._id, 'User logout all devices');
      
      // Clear current cookie
      res.clearCookie('refreshToken', { path: '/' });
      
      return ApiResponse.success(res, null, 'All sessions revoked successfully');
      
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      return ApiResponse.error(res, 'Failed to revoke sessions', 500);
    }
  }

  // Revoke all sessions except current
  static async revokeOtherSessions(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      
      if (!refreshToken) {
        return ApiResponse.error(res, 'No current session found', 400);
      }
      
      await SessionService.revokeOtherSessions(
        req.user._id, 
        refreshToken, 
        'User logout other devices'
      );
      
      return ApiResponse.success(res, null, 'Other sessions revoked successfully');
      
    } catch (error) {
      console.error('Revoke other sessions error:', error);
      return ApiResponse.error(res, 'Failed to revoke sessions', 500);
    }
  }
}

module.exports = SessionController;
