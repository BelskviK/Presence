import express from 'express';
import { getDashboard, getActivity } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate, authorize('MANAGER', 'ADMIN'));

router.get('/', getDashboard);
router.get('/activity', getActivity);

export default router;
