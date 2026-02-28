const express = require('express');
const router = express.Router();
const { AuthController } = require('../controllers');
const { 
  protect, 
  registerValidation, 
  loginValidation, 
  refreshValidation,
  verifySessionValidation,
  authLimiter,
  loginLimiter,
  refreshLimiter
} = require('../middleware');

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, registerValidation, AuthController.register);

// @route   POST /auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, loginValidation, AuthController.login);

// @route   POST /auth/refresh
// @desc    Refresh access token (rotates refresh token)
// @access  Public (requires valid refresh token)
router.post('/refresh', refreshLimiter, refreshValidation, AuthController.refresh);

// @route   POST /auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', AuthController.logout);

// @route   POST /auth/verify-session
// @desc    Verify suspicious session
// @access  Private
router.post('/verify-session', protect, verifySessionValidation, AuthController.verifySession);

// @route   GET /auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', protect, AuthController.me);

// TEST ENDPOINTS - For demonstrating token theft detection
// @route   POST /auth/test/save-token
// @desc    Save current refresh token for theft simulation
// @access  Private
router.post('/test/save-token', protect, AuthController.saveTokenForTest);

// @route   POST /auth/test/simulate-theft
// @desc    Attempt to use saved (invalidated) token to trigger theft detection
// @access  Private
router.post('/test/simulate-theft', protect, AuthController.simulateTokenTheft);

// TEST ENDPOINTS - For suspicious login testing
// @route   GET /auth/test/device-info
// @desc    Get current device info detected by server
// @access  Private
router.get('/test/device-info', protect, AuthController.getDeviceInfo);

// @route   POST /auth/test/clear-locations
// @desc    Clear user's known locations to reset suspicious login detection
// @access  Private
router.post('/test/clear-locations', protect, AuthController.clearKnownLocations);

// @route   POST /auth/test/simulate-suspicious
// @desc    Simulate suspicious login with fake country/IP
// @access  Private
router.post('/test/simulate-suspicious', protect, AuthController.simulateSuspiciousLogin);

// @route   POST /auth/test/add-location
// @desc    Add a known location to user for testing
// @access  Private
router.post('/test/add-location', protect, AuthController.addKnownLocation);

module.exports = router;
