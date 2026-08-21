import express from 'express';
import {
  submitLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getMyLeaveBalance,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from '../controllers/leaveController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

router.use(authenticate);

router.post('/', logAction('LEAVE_REQUEST', 'LEAVE', (req, body) => body?.request?.id || null), submitLeaveRequest);
router.get('/mine', getMyLeaveRequests);
router.get('/balance', getMyLeaveBalance);
router.get('/', authorize('MANAGER', 'ADMIN'), getAllLeaveRequests);
router.put('/:id/approve', authorize('MANAGER', 'ADMIN'), logAction('LEAVE_APPROVE', 'LEAVE', (req) => req.params.id), approveLeaveRequest);
router.put('/:id/reject', authorize('MANAGER', 'ADMIN'), logAction('LEAVE_REJECT', 'LEAVE', (req) => req.params.id), rejectLeaveRequest);
router.put('/:id/cancel', cancelLeaveRequest);

export default router;
