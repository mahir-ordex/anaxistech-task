const { User, Session } = require('../models');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  getRefreshTokenExpiry,
  generateVerificationToken,
  parseDeviceInfo,
  isSameIPRange
} = require('../utils');

class AuthService {
  // Create a new session for user
  static async createSession(user, req, options = {}) {
    const deviceInfo = parseDeviceInfo(req, options);
    const tokenFamily = Session.generateTokenFamily();
    
    // Check for suspicious activity
    const suspiciousCheck = await this.checkSuspiciousLogin(user, deviceInfo);
    
    // Check session limit and remove oldest if needed
    await this.enforceSessionLimit(user._id);
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user._id, null, tokenFamily, user.tokenVersion);
    
    // Create session
    const session = new Session({
      user: user._id,
      refreshTokenHash: Session.hashToken(refreshToken),
      refreshTokenFamily: tokenFamily,
      ...deviceInfo,
      isSuspicious: suspiciousCheck.isSuspicious,
      suspiciousReason: suspiciousCheck.reason,
      isVerified: !suspiciousCheck.isSuspicious,
      expiresAt: getRefreshTokenExpiry()
    });
    
    // If suspicious, generate verification token
    if (suspiciousCheck.isSuspicious) {
      session.verificationToken = generateVerificationToken();
      session.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
    
    await session.save();
    
    // Update user's known IPs and countries
    await this.updateKnownLocations(user, deviceInfo);
    
    return {
      accessToken,
      refreshToken,
      session,
      requiresVerification: suspiciousCheck.isSuspicious
    };
  }

  // Check for suspicious login
  static async checkSuspiciousLogin(user, deviceInfo) {
    // Skip for new users (no known IPs/countries)
    if (!user.knownCountries?.length && !user.knownIPs?.length) {
      return { isSuspicious: false };
    }
    
    // Check country
    if (deviceInfo.country !== 'Local' && deviceInfo.country !== 'Unknown') {
      if (user.knownCountries?.length && !user.knownCountries.includes(deviceInfo.country)) {
        return { 
          isSuspicious: true, 
          reason: `Login from new country: ${deviceInfo.country}` 
        };
      }
    }
    
    // Check IP range
    if (deviceInfo.ipAddress && user.knownIPs?.length) {
      const isKnownIPRange = user.knownIPs.some(ip => isSameIPRange(ip, deviceInfo.ipAddress));
      if (!isKnownIPRange) {
        return { 
          isSuspicious: true, 
          reason: `Login from new IP range: ${deviceInfo.ipAddress}` 
        };
      }
    }
    
    return { isSuspicious: false };
  }

  // Update user's known locations
  static async updateKnownLocations(user, deviceInfo) {
    const updates = {};
    
    if (deviceInfo.country && deviceInfo.country !== 'Unknown' && deviceInfo.country !== 'Local') {
      if (!user.knownCountries?.includes(deviceInfo.country)) {
        updates.$addToSet = { ...updates.$addToSet, knownCountries: deviceInfo.country };
      }
    }
    
    if (deviceInfo.ipAddress) {
      // Only store unique IP ranges (check first 3 octets)
      const shouldAddIP = !user.knownIPs?.some(ip => isSameIPRange(ip, deviceInfo.ipAddress));
      if (shouldAddIP) {
        updates.$addToSet = { ...updates.$addToSet, knownIPs: deviceInfo.ipAddress };
      }
    }
    
    updates.$set = { lastLogin: new Date() };
    
    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(user._id, updates);
    }
  }

  // Enforce session limit (max 3 sessions) - uses atomic operation to prevent race conditions
  static async enforceSessionLimit(userId) {
    const maxSessions = parseInt(process.env.MAX_SESSIONS_PER_USER) || 3;
    await Session.enforceSessionLimitAtomic(userId, maxSessions);
  }

  // Rotate refresh token
  static async rotateRefreshToken(oldRefreshToken, req) {
    const verification = verifyRefreshToken(oldRefreshToken);
    
    if (!verification.valid) {
      throw new Error('Invalid refresh token');
    }
    
    const { tokenFamily, tokenVersion, userId } = verification.decoded;
    
    // Check if token has been reused (theft detection)
    const isReused = await Session.isTokenReused(oldRefreshToken, tokenFamily);
    
    if (isReused) {
      // Token theft detected! Revoke entire token family
      await Session.revokeTokenFamily(tokenFamily, 'Token theft detected - token reused');
      
      // Increment user's token version to invalidate ALL sessions
      const user = await User.findById(userId);
      if (user) {
        await user.incrementTokenVersion();
        // Revoke all sessions for this user
        await Session.revokeAllUserSessions(userId, 'Token theft detected - all sessions invalidated');
      }
      
      throw new Error('TOKEN_THEFT_DETECTED');
    }
    
    // Atomically find and revoke the session - prevents race conditions
    // Only one request can succeed; others will get null
    const session = await Session.findAndRevokeAtomic(oldRefreshToken, 'Token rotated');
    
    if (!session) {
      // Session not found, already revoked, or expired
      // This handles the race condition - second request fails here
      throw new Error('Session not found or already used');
    }
    
    // Check if user's token version matches
    const user = await User.findById(session.user._id || session.user);
    if (!user || user.tokenVersion !== tokenVersion) {
      throw new Error('Session invalidated');
    }
    
    // Check if session requires verification
    if (session.isSuspicious && !session.isVerified) {
      throw new Error('SESSION_REQUIRES_VERIFICATION');
    }
    
    // Generate new tokens with same family
    const newRefreshToken = generateRefreshToken(user._id, null, tokenFamily, user.tokenVersion);
    const newAccessToken = generateAccessToken(user._id, user.tokenVersion);
    
    // Parse device info from current request
    const deviceInfo = parseDeviceInfo(req);
    
    // Create new session with rotated token
    const newSession = new Session({
      user: user._id,
      refreshTokenHash: Session.hashToken(newRefreshToken),
      refreshTokenFamily: tokenFamily,
      ...deviceInfo,
      isSuspicious: false,
      isVerified: true,
      expiresAt: getRefreshTokenExpiry()
    });
    
    await newSession.save();
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      session: newSession
    };
  }

  // Logout (revoke session)
  static async logout(refreshToken) {
    if (!refreshToken) {
      return true;
    }
    
    const session = await Session.findByRefreshToken(refreshToken);
    if (session) {
      await session.revoke('User logout');
    }
    
    return true;
  }

  // Verify suspicious session
  static async verifySession(sessionId, verificationToken, userId) {
    const session = await Session.findOne({
      _id: sessionId,
      user: userId,
      isRevoked: false
    });
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (!session.isSuspicious) {
      throw new Error('Session does not require verification');
    }
    
    if (session.verificationToken !== verificationToken) {
      throw new Error('Invalid verification token');
    }
    
    if (session.verificationTokenExpires < new Date()) {
      throw new Error('Verification token expired');
    }
    
    session.isVerified = true;
    session.verificationToken = undefined;
    session.verificationTokenExpires = undefined;
    await session.save();
    
    return session;
  }
}

module.exports = AuthService;
