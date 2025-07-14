// auth-service/server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/finmark';

// Connect to MongoDB with retry logic
const connectWithRetry = () => {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
      console.error('MongoDB connection error:', err);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// User model with enhanced validation
const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true
  },
  role: { 
    type: String, 
    default: 'user',
    enum: {
      values: ['user', 'admin'],
      message: '{VALUE} is not a valid role'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Middleware
app.use(express.json());

// Sanitize and validate registration input
const registrationValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail()
    .escape(),
  body('password')
    .trim()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters long')
    .escape()
];

// Registration endpoint with enhanced error handling
app.post('/register', registrationValidation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: true,
        message: 'Validation failed',
        details: errors.array().map(err => ({ field: err.param, message: err.msg }))
      });
    }

    // Check for missing required fields
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: true,
        message: 'Missing required fields',
        details: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
          name: !name ? 'Name is required' : undefined
        }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        error: true,
        message: 'User already exists',
        field: 'email'
      });
    }

    // Create new user
    const user = new User({ email, password, name });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    // Check for MongoDB duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        error: true,
        message: 'User already exists',
        field: 'email'
      });
    }
    
    // Check for MongoDB validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        details: errors
      });
    }
    
    console.error('Registration error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Server error during registration',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Login validation
const loginValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail()
    .escape(),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
];

// Login endpoint with enhanced error handling
app.post('/login', loginValidation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: true,
        message: 'Validation failed',
        details: errors.array().map(err => ({ field: err.param, message: err.msg }))
      });
    }

    // Check for missing required fields
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        error: true,
        message: 'Missing required fields',
        details: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        }
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Use vague message for security (don't reveal if email exists)
      return res.status(401).json({ 
        error: true,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        error: true,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Auth middleware with better error handling
const auth = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      error: true,
      message: 'No token, authorization denied' 
    });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: true,
        message: 'Token has expired' 
      });
    }
    
    res.status(401).json({ 
      error: true,
      message: 'Token is not valid' 
    });
  }
};

// Protected route with error handling
app.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: true,
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error retrieving profile',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'auth-service',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Apply error handler middleware
app.use(errorHandler);

// Start server with error handling
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log to monitoring service in production
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to monitoring service in production
});