const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
// Register User
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }
      const { name, email, password } = req.body;
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ 
          success: false,
          message: 'User already exists with this email' 
        });
      }
      // Create new user
      user = new User({
        name,
        email,
        password
      });
      await user.save();
      // Create JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error during registration' 
      });
    }
  }
);
// Login User
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }
      const { email, password } = req.body;
      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid email or password' 
        });
      }
      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid email or password' 
        });
      }
      // Update last login
      user.lastLogin = Date.now();
      await user.save();
      // Create JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error during login' 
      });
    }
  }
);
// Get Current User
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
});
module.exports = router;