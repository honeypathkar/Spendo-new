const User = require('../models/User');
const { generateOTP, sendOTP } = require('../utils/otpService');
const { generateToken } = require('../utils/jwt');
const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Send OTP for phone-based login
const sendOTPForLogin = async (req, res) => {
  try {
    const { phone, email } = req.body;

    // Since we're using Gmail server, email is required for sending OTP
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to send OTP via Gmail',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await User.findOne({
      $or: [{ phone }, { email }],
    });

    if (user) {
      // Update OTP for existing user
      user.otp = {
        code: otp,
        expiresAt,
      };
      user.authMethod = 'otp';
      if (phone) user.phone = phone;
      if (email) user.email = email;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        phone: phone || null,
        email: email,
        name: phone || email || 'User',
        authMethod: 'otp',
        otp: {
          code: otp,
          expiresAt,
        },
        isVerified: false,
      });
    }

    // Send OTP via email (Gmail server)
    await sendOTP(email, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      userId: user._id,
    });
  } catch (error) {
    console.error('Error in sendOTPForLogin:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP',
    });
  }
};

// Verify OTP and login
const verifyOTP = async (req, res) => {
  try {
    const { userId, otp, phone, email } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required',
      });
    }

    // Find user
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (phone || email) {
      user = await User.findOne({
        $or: [{ phone }, { email }],
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'User identifier (userId, phone, or email) is required',
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if OTP exists and is valid
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new OTP.',
      });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    // Verify user and clear OTP
    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authMethod: user.authMethod,
      },
    });
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify OTP',
    });
  }
};

// Google Sign-In
const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required',
      });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      // Update user with Google info if needed
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.name && name) {
        user.name = name;
      }
      if (!user.email && email) {
        user.email = email;
      }
      user.authMethod = 'google';
      user.isVerified = true;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        googleId,
        email,
        name: name || 'User',
        authMethod: 'google',
        isVerified: true,
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Google sign-in successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authMethod: user.authMethod,
      },
    });
  } catch (error) {
    console.error('Error in googleSignIn:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to authenticate with Google',
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-otp');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authMethod: user.authMethod,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get profile',
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        authMethod: user.authMethod,
      },
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile',
    });
  }
};

module.exports = {
  sendOTPForLogin,
  verifyOTP,
  googleSignIn,
  getProfile,
  updateProfile,
};

