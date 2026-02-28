const { User } = require('../models');
const { AuthService } = require('../services');
const { ApiResponse } = require('../utils');

// Cookie options helper for cross-site compatibility
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/'
});

class AuthController {
  // Register new user
  static async register(req, res) {
    try {
      const { email, password, name } = req.body;
      
      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return ApiResponse.error(res, 'Email already registered', 409);
      }
      
      // Create new user
      const user = new User({
        email,
        password,
        name,
        role: 'user'
      });
      
      await user.save();
      
      // Create session
      const { accessToken, refreshToken, session, requiresVerification } = 
        await AuthService.createSession(user, req);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, getCookieOptions());
      
      return ApiResponse.success(res, {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken, // Also return in body for cross-origin support
        session: {
          id: session._id,
          deviceName: session.deviceName,
          browser: session.browser,
          isSuspicious: session.isSuspicious
        },
        requiresVerification
      }, 'Registration successful', 201);
      
    } catch (error) {
      console.error('Register error:', error);
      return ApiResponse.error(res, 'Registration failed', 500);
    }
  }

  // Login
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Find user with password
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      
      if (!user) {
        return ApiResponse.error(res, 'Invalid credentials', 401);
      }
      
      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return ApiResponse.error(res, 'Invalid credentials', 401);
      }
      
      // Create session with optional GPS coordinates
      const sessionOptions = {};
      if (req.body.latitude && req.body.longitude) {
        sessionOptions.latitude = req.body.latitude;
        sessionOptions.longitude = req.body.longitude;
      }
      
      const { accessToken, refreshToken, session, requiresVerification } = 
        await AuthService.createSession(user, req, sessionOptions);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, getCookieOptions());
      
      // If session is suspicious, include verification info
      const response = {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken, // Also return in body for cross-origin support
        session: {
          id: session._id,
          deviceName: session.deviceName,
          browser: session.browser,
          isSuspicious: session.isSuspicious,
          suspiciousReason: session.suspiciousReason
        },
        requiresVerification
      };
      
      // Handle suspicious login verification
      if (requiresVerification) {
        // TODO: Send verification email with token: session.verificationToken
        // In production, integrate email service here (SendGrid, SES, etc.)
        console.log(`[DEV] Verification token for ${user.email}: ${session.verificationToken}`);
        response.message = 'Login from new location detected. Please check your email to verify this session.';
      }
      
      return ApiResponse.success(res, response, 'Login successful');
      
    } catch (error) {
      console.error('Login error:', error);
      return ApiResponse.error(res, 'Login failed', 500);
    }
  }

  // Refresh token
  static async refresh(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      
      if (!refreshToken) {
        return ApiResponse.unauthorized(res, 'No refresh token provided');
      }
      
      const result = await AuthService.rotateRefreshToken(refreshToken, req);
      
      // Set new refresh token in cookie
      res.cookie('refreshToken', result.refreshToken, getCookieOptions());
      
      return ApiResponse.success(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken, // Also return in body for cross-origin support
        session: {
          id: result.session._id,
          deviceName: result.session.deviceName
        }
      }, 'Token refreshed successfully');
      
    } catch (error) {
      // Clear the cookie on error
      res.clearCookie('refreshToken', getClearCookieOptions());
      
      if (error.message === 'TOKEN_THEFT_DETECTED') {
        return ApiResponse.error(res, 
          'Security alert: Potential token theft detected. All sessions have been invalidated. Please login again.', 
          401
        );
      }
      
      if (error.message === 'SESSION_REQUIRES_VERIFICATION') {
        return ApiResponse.error(res, 
          'Session requires verification. Please verify your session first.', 
          403
        );
      }
      
      console.error('Refresh error:', error);
      return ApiResponse.unauthorized(res, 'Invalid or expired refresh token');
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      
      await AuthService.logout(refreshToken);
      
      // Clear cookie
      res.clearCookie('refreshToken', getClearCookieOptions());
      
      return ApiResponse.success(res, null, 'Logged out successfully');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear cookie even on error
      res.clearCookie('refreshToken', getClearCookieOptions());
      return ApiResponse.success(res, null, 'Logged out');
    }
  }

  // Verify suspicious session
  static async verifySession(req, res) {
    try {
      const { sessionId, verificationToken } = req.body;
      
      const session = await AuthService.verifySession(
        sessionId, 
        verificationToken, 
        req.user._id
      );
      
      return ApiResponse.success(res, {
        session: {
          id: session._id,
          isVerified: session.isVerified
        }
      }, 'Session verified successfully');
      
    } catch (error) {
      console.error('Verify session error:', error);
      return ApiResponse.error(res, error.message || 'Verification failed', 400);
    }
  }

  // Get current user
  static async me(req, res) {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }
      
      return ApiResponse.success(res, {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt
        }
      });
      
    } catch (error) {
      console.error('Get me error:', error);
      return ApiResponse.error(res, 'Failed to get user info', 500);
    }
  }

  // TEST ONLY: Save current refresh token for theft simulation
  // This stores the token hash so we can simulate reuse after rotation
  static savedTestTokens = new Map(); // userId -> refreshToken

  static async saveTokenForTest(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      
      if (!refreshToken) {
        return ApiResponse.error(res, 'No refresh token found. Please login again.', 400);
      }
      
      // Store the token for this user (for testing purposes)
      AuthController.savedTestTokens.set(req.user._id.toString(), refreshToken);
      
      return ApiResponse.success(res, {
        message: 'Token saved for testing',
        tokenPreview: refreshToken.substring(0, 20) + '...'
      }, 'Token saved successfully');
      
    } catch (error) {
      console.error('Save token for test error:', error);
      return ApiResponse.error(res, 'Failed to save token', 500);
    }
  }

  // TEST ONLY: Simulate token theft by reusing saved (now-invalidated) token
  static async simulateTokenTheft(req, res) {
    try {
      const savedToken = AuthController.savedTestTokens.get(req.user._id.toString());
      
      if (!savedToken) {
        return ApiResponse.error(res, 'No saved token found. Click "Save Token" first, then "Rotate Token".', 400);
      }
      
      // Clear the saved token
      AuthController.savedTestTokens.delete(req.user._id.toString());
      
      // Try to use the old (should be invalidated) token
      try {
        await AuthService.rotateRefreshToken(savedToken, req);
        // If we get here, the token wasn't properly invalidated (shouldn't happen)
        return ApiResponse.error(res, 'Token was still valid - theft detection failed!', 500);
      } catch (error) {
        if (error.message === 'TOKEN_THEFT_DETECTED') {
          return ApiResponse.success(res, {
            theftDetected: true,
            message: 'Token theft detected! All sessions have been invalidated.'
          }, 'Security test successful - theft was detected');
        } else {
          return ApiResponse.success(res, {
            theftDetected: false,
            tokenRejected: true,
            message: `Token was rejected: ${error.message}`
          }, 'Token was invalidated correctly');
        }
      }
      
    } catch (error) {
      console.error('Simulate theft error:', error);
      return ApiResponse.error(res, 'Test failed: ' + error.message, 500);
    }
  }

  // DEBUG: Get current device info detected by server
  static async getDeviceInfo(req, res) {
    try {
      const { parseDeviceInfo } = require('../utils');
      const deviceInfo = parseDeviceInfo(req);
      const user = await User.findById(req.user._id);
      
      return ApiResponse.success(res, {
        detected: deviceInfo,
        userKnownLocations: {
          knownCountries: user?.knownCountries || [],
          knownIPs: user?.knownIPs || []
        },
        note: 'If country is "Local", VPN detection won\'t work because you\'re accessing localhost'
      });
    } catch (error) {
      console.error('Get device info error:', error);
      return ApiResponse.error(res, 'Failed to get device info', 500);
    }
  }

  // TEST ONLY: Clear user's known locations to test suspicious login
  static async clearKnownLocations(req, res) {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $set: { knownIPs: [], knownCountries: [] }
      });
      
      return ApiResponse.success(res, {
        message: 'Known locations cleared. Next login from any location will be treated as first login.'
      });
    } catch (error) {
      console.error('Clear known locations error:', error);
      return ApiResponse.error(res, 'Failed to clear locations', 500);
    }
  }

  // TEST ONLY: Simulate suspicious login by faking a different country/IP
  static async simulateSuspiciousLogin(req, res) {
    try {
      const { country, ipAddress } = req.body;
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }
      
      // Create fake device info
      const fakeDeviceInfo = {
        country: country || 'RU', // Default to Russia for testing
        ipAddress: ipAddress || '185.220.100.240', // Random foreign IP
        city: 'Unknown',
        deviceName: 'Test Device',
        browser: 'Test Browser',
        os: 'Test OS'
      };
      
      // Run suspicious check with fake data
      const suspiciousCheck = await AuthService.checkSuspiciousLogin(user, fakeDeviceInfo);
      
      return ApiResponse.success(res, {
        wouldBeSuspicious: suspiciousCheck.isSuspicious,
        reason: suspiciousCheck.reason || 'No suspicious activity detected',
        fakeDeviceInfo,
        userKnownLocations: {
          knownCountries: user.knownCountries || [],
          knownIPs: user.knownIPs || []
        },
        tip: suspiciousCheck.isSuspicious 
          ? 'This login would be marked as suspicious and require verification!'
          : 'Login would NOT be suspicious. Try clearing known locations first, then login normally, then test with a different country.'
      });
    } catch (error) {
      console.error('Simulate suspicious login error:', error);
      return ApiResponse.error(res, 'Test failed: ' + error.message, 500);
    }
  }

  // TEST ONLY: Force add a known location to user
  static async addKnownLocation(req, res) {
    try {
      const { country, ipAddress } = req.body;
      const updates = {};
      
      if (country) {
        updates.$addToSet = { ...updates.$addToSet, knownCountries: country };
      }
      if (ipAddress) {
        updates.$addToSet = { ...updates.$addToSet, knownIPs: ipAddress };
      }
      
      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'Provide country or ipAddress', 400);
      }
      
      const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
      
      return ApiResponse.success(res, {
        message: 'Known location added',
        knownCountries: user.knownCountries,
        knownIPs: user.knownIPs
      });
    } catch (error) {
      console.error('Add known location error:', error);
      return ApiResponse.error(res, 'Failed to add location', 500);
    }
  }
}

module.exports = AuthController;
