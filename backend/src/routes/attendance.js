import express from 'express';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getTodayAttendance,
  getAttendanceRecords,
  getActiveClockedIn,
  getAttendanceSummary,
  editAttendance,
} from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// All attendance routes require authentication
router.use(authenticate);

// Clock in/out
router.post('/clock-in', logAction('CLOCK_IN', 'ATTENDANCE'), clockIn);
router.post('/clock-out', logAction('CLOCK_OUT', 'ATTENDANCE'), clockOut);
router.post('/break-start', startBreak);
router.post('/break-end', endBreak);

// Get attendance data
router.get('/today', getTodayAttendance);
router.get('/records', getAttendanceRecords);
router.get('/active-now', authorize('MANAGER', 'ADMIN'), getActiveClockedIn);
router.get('/summary', getAttendanceSummary);

// Edit attendance (Manager/Admin only)
router.put('/:id', authorize('MANAGER', 'ADMIN'), logAction('ATTENDANCE_EDIT', 'ATTENDANCE', (req) => req.params.id), editAttendance);

export default router;
