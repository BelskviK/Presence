import express from 'express';
import {
  createGeofence,
  getGeofences,
  getGeofence,
  updateGeofence,
  deleteGeofence,
  addUsersToFreeCheckIn,
  removeUsersFromFreeCheckIn,
} from '../controllers/geofenceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// All geofence routes require authentication
router.use(authenticate);

// Get geofences (accessible to all, but mainly for clock-in verification)
router.get('/', getGeofences);
router.get('/:id', getGeofence);

// Admin only operations
router.post('/', authorize('ADMIN'), logAction('GEOFENCE_CREATE', 'GEOFENCE', (req, body) => body?.geofence?.id || null), createGeofence);
router.put('/:id', authorize('ADMIN'), logAction('GEOFENCE_UPDATE', 'GEOFENCE', (req) => req.params.id), updateGeofence);
router.delete('/:id', authorize('ADMIN'), logAction('GEOFENCE_DELETE', 'GEOFENCE', (req) => req.params.id), deleteGeofence);

// Manage free check-in users
router.post('/:id/add-free-checkin', authorize('ADMIN'), addUsersToFreeCheckIn);
router.post('/:id/remove-free-checkin', authorize('ADMIN'), removeUsersFromFreeCheckIn);

export default router;
