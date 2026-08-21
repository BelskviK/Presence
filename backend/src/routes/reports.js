import express from 'express';
import { exportAttendanceExcel, exportAttendancePDF } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/attendance/excel', exportAttendanceExcel);
router.get('/attendance/pdf', exportAttendancePDF);

export default router;
