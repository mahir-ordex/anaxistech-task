const mongoose = require('mongoose');
const crypto = require('crypto');

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refreshTokenHash: {
    type: String,
    required: true,
    unique: true
  },
  refreshTokenFamily: {
    type: String,
    required: true,
    index: true
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  browser: {
    type: String,
    default: 'Unknown Browser'
  },
  os: {
    type: String,
    default: 'Unknown OS'
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  locationSource: {
    type: String,
    enum: ['ip', 'gps'],
    default: 'ip'
  },
  isSuspicious: {
    type: Boolean,
    default: false
  },
  suspiciousReason: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedAt: Date,
  revokedReason: String
}, {
  timestamps: true
});

// Index for cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to hash refresh token
sessionSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method to generate token family ID
sessionSchema.statics.generateTokenFamily = function() {
  return crypto.randomBytes(16).toString('hex');
};

// Static method to find session by refresh token
sessionSchema.statics.findByRefreshToken = async function(token) {
  const hash = this.hashToken(token);
  return await this.findOne({ 
    refreshTokenHash: hash,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('user');
};

// Static method to check for token reuse (theft detection)
sessionSchema.statics.isTokenReused = async function(token, family) {
  const hash = this.hashToken(token);
  
  // Find if this exact token was already used (exists but revoked)
  const revokedSession = await this.findOne({
    refreshTokenHash: hash,
    isRevoked: true
  });
  
  return !!revokedSession;
};


sessionSchema.statics.findAndRevokeAtomic = async function(token, reason = 'Token rotated') {
  const hash = this.hashToken(token);
  
  // Atomically find and update - only succeeds for one request
  const session = await this.findOneAndUpdate(
    {
      refreshTokenHash: hash,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason
      }
    },
    {
      new: false, // Return original document (before update)
      populate: 'user'
    }
  );
  
  return session;
};

// Method to revoke session
sessionSchema.methods.revoke = async function(reason = 'Manual logout') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  await this.save();
};

// Static method to revoke all sessions for a token family (token theft)
sessionSchema.statics.revokeTokenFamily = async function(family, reason) {
  await this.updateMany(
    { refreshTokenFamily: family },
    { 
      isRevoked: true, 
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

// Static method to revoke all user sessions
sessionSchema.statics.revokeAllUserSessions = async function(userId, reason) {
  await this.updateMany(
    { user: userId, isRevoked: false },
    { 
      isRevoked: true, 
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

// Static method to get active sessions count
sessionSchema.statics.getActiveSessionsCount = async function(userId) {
  return await this.countDocuments({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to get oldest session
sessionSchema.statics.getOldestSession = async function(userId) {
  return await this.findOne({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: 1 });
};

// Atomic method to enforce session limit - prevents race conditions
sessionSchema.statics.enforceSessionLimitAtomic = async function(userId, maxSessions = 3) {
  const activeSessions = await this.find({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: 1 });
  
  // If at or above limit, revoke oldest sessions to make room for new one
  const sessionsToRevoke = activeSessions.length >= maxSessions 
    ? activeSessions.slice(0, activeSessions.length - maxSessions + 1) 
    : [];
  
  if (sessionsToRevoke.length > 0) {
    const idsToRevoke = sessionsToRevoke.map(s => s._id);
    await this.updateMany(
      { _id: { $in: idsToRevoke } },
      { 
        isRevoked: true, 
        revokedAt: new Date(),
        revokedReason: 'Session limit exceeded - oldest session removed'
      }
    );
  }
  
  return sessionsToRevoke.length;
};

// Update lastUsedAt timestamp (throttled to reduce DB writes)
sessionSchema.statics.updateLastUsed = async function(refreshTokenHash) {
  await this.updateOne(
    { refreshTokenHash, isRevoked: false },
    { $set: { lastUsedAt: new Date() } }
  );
};

module.exports = mongoose.model('Session', sessionSchema);
