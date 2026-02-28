const express = require('express');
const router = express.Router();
const { AdminController } = require('../controllers');
const { 
  protect, 
  adminOnly,
  userIdValidation,
  sessionIdValidation,
  paginationValidation
} = require('../middleware');

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// @route   GET /admin/sessions
// @desc    Get all active sessions (all users)
// @access  Admin
router.get('/sessions', paginationValidation, AdminController.getAllSessions);

// @route   GET /admin/users
// @desc    Get all users
// @access  Admin
router.get('/users', paginationValidation, AdminController.getUsers);

// @route   DELETE /admin/users/:userId/sessions
// @desc    Force logout a user from all devices
// @access  Admin
router.delete('/users/:userId/sessions', userIdValidation, AdminController.forceLogoutUser);

// @route   DELETE /admin/sessions/:sessionId
// @desc    Revoke a specific session
// @access  Admin
router.delete('/sessions/:sessionId', AdminController.revokeSession);

module.exports = router;
