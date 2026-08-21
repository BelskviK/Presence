import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { provisionDefaultBalances } from './leaveController.js';
import { recordLogin } from '../middleware/auditLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const signTokens = (userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your_jwt_secret_key', {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key', {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d',
  });
  return { token, refreshToken };
};

// Register new user (Admin only)
export const register = asyncHandler(async (req, res) => {
  const {
    email, password, firstName, lastName, role, department, position, salary,
    workingHoursPerDay, phone, canCheckInFromAnywhere, officeLocationId,
  } = req.body;

  if (!email || !password || !firstName || !lastName || !department || !position || !salary) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
    });
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered',
    });
  }

  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    role: role || 'EMPLOYEE',
    department,
    position,
    salary,
    workingHoursPerDay: workingHoursPerDay || 8,
    phone,
    canCheckInFromAnywhere,
    officeLocationId,
  });

  await provisionDefaultBalances(user.id);

  const { token, refreshToken } = signTokens(user.id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: User.toSafeUser(user),
    token,
    refreshToken,
  });
});

// Login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password required',
    });
  }

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  const isPasswordValid = await User.matchPassword(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Deactivated accounts keep their history but can no longer sign in.
  if (user.status === 'INACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This account has been deactivated. Contact an administrator.',
    });
  }

  const updatedUser = await User.updateLastLogin(user.id);
  recordLogin(updatedUser, req);

  const { token, refreshToken } = signTokens(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    user: User.toSafeUser(updatedUser),
    token,
    refreshToken,
  });
});

// Refresh token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token required',
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your_jwt_secret_key', {
      expiresIn: process.env.JWT_EXPIRY || '7d',
    });

    res.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
});

// Get current user
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  res.json({
    success: true,
    user: User.toSafeUser(user),
  });
});

// List all users (Manager/Admin) — for employee pickers, admin management, etc.
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll();
  res.json({
    success: true,
    users,
  });
});

// Update a user (Admin) — e.g. reassign office location, change role/department
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await User.findById(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const {
    firstName, lastName, role, department, position, salary,
    workingHoursPerDay, phone, canCheckInFromAnywhere, officeLocationId, status,
  } = req.body;

  // Guard against an admin locking themselves out of their own account.
  if (id === req.userId && (status === 'INACTIVE' || (role && role !== 'ADMIN'))) {
    return res.status(400).json({
      success: false,
      message: 'You cannot deactivate or demote your own admin account',
    });
  }

  const user = await User.update(id, {
    firstName, lastName, role, department, position, salary,
    workingHoursPerDay, phone, canCheckInFromAnywhere, officeLocationId, status,
  });

  res.json({
    success: true,
    message: 'User updated',
    user: User.toSafeUser(user),
  });
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  // In JWT, logout is handled on the client side by deleting the token
  res.json({
    success: true,
    message: 'Logout successful',
  });
});
