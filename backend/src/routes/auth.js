import express from 'express';
import {
  register,
  login,
  refreshAccessToken,
  getCurrentUser,
  getAllUsers,
  updateUser,
  logout,
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// Only an existing ADMIN can create new accounts (see backend/src/db/seed_admin.sql
// for bootstrapping the very first admin directly in the database).
router.post('/register', authenticate, authorize('ADMIN'), logAction('USER_CREATE', 'USER', (req, body) => body?.user?.id || null), register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.get('/me', authenticate, getCurrentUser);
router.get('/users', authenticate, authorize('MANAGER', 'ADMIN'), getAllUsers);
router.put('/users/:id', authenticate, authorize('ADMIN'), logAction('USER_UPDATE', 'USER', (req) => req.params.id), updateUser);
router.post('/logout', authenticate, logout);

export default router;
