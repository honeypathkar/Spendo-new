const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  sendOTPForLogin,
  verifyOTP,
  googleSignIn,
  getProfile,
  updateProfile,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Send OTP
router.post(
  '/otp/send',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().isMobilePhone(),
  ],
  sendOTPForLogin
);

// Verify OTP
router.post(
  '/otp/verify',
  [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('userId').optional().isMongoId(),
    body('phone').optional(),
    body('email').optional().isEmail(),
  ],
  verifyOTP
);

// Google Sign-In
router.post(
  '/google',
  [body('idToken').notEmpty()],
  googleSignIn
);

// Get profile (protected)
router.get('/profile', authenticate, getProfile);

// Update profile (protected)
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
  ],
  updateProfile
);

module.exports = router;

