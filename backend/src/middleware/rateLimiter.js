const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/ApiResponse');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { 
    success: false, 
    message: 'Too many requests, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: { 
    success: false, 
    message: 'Too many authentication attempts, please try again after 15 minutes' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Very strict rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed login attempts per hour
  message: { 
    success: false, 
    message: 'Too many login attempts, please try again after an hour' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

// Rate limiter for refresh token endpoint
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 refresh requests per minute
  message: { 
    success: false, 
    message: 'Too many refresh attempts, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for password-related operations
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: { 
    success: false, 
    message: 'Too many password reset attempts, please try again after an hour' 
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  refreshLimiter,
  passwordLimiter
};
