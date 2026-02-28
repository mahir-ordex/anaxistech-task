const express = require('express');
const router = express.Router();
const { SessionController } = require('../controllers');
const { 
  protect, 
  sessionIdValidation 
} = require('../middleware');

// All routes require authentication
router.use(protect);

// @route   GET /sessions
// @desc    Get all active sessions for current user
// @access  Private
router.get('/', SessionController.getSessions);

// @route   DELETE /sessions/other
// @desc    Logout all other devices (keep current)
// @access  Private
router.delete('/other', SessionController.revokeOtherSessions);

// @route   DELETE /sessions/:id
// @desc    Logout specific device/session
// @access  Private
router.delete('/:id', sessionIdValidation, SessionController.revokeSession);

// @route   DELETE /sessions
// @desc    Logout all devices
// @access  Private
router.delete('/', SessionController.revokeAllSessions);

module.exports = router;
