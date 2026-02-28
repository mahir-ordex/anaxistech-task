const { body, param, query, validationResult } = require('express-validator');
const ApiResponse = require('../utils/ApiResponse');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));
    
    return ApiResponse.validationError(res, formattedErrors);
  }
  
  next();
};

// Register validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  handleValidationErrors
];

// Login validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Refresh token validation
const refreshValidation = [
  // Optional - can come from cookie or body
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('Invalid refresh token format'),
  handleValidationErrors
];

// Session ID param validation
const sessionIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid session ID'),
  handleValidationErrors
];

// User ID param validation
const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  handleValidationErrors
];

// Session verification validation
const verifySessionValidation = [
  body('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID'),
  body('verificationToken')
    .isString()
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid verification token'),
  handleValidationErrors
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  refreshValidation,
  sessionIdValidation,
  userIdValidation,
  verifySessionValidation,
  paginationValidation,
  handleValidationErrors
};
