import GeofenceLocation from '../models/GeofenceLocation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Create geofence location
export const createGeofence = asyncHandler(async (req, res) => {
  const { name, address, latitude, longitude, radiusMeters, description, departmentsAllowed } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Name, latitude, and longitude are required',
    });
  }

  const geofence = await GeofenceLocation.create({
    name,
    address,
    latitude,
    longitude,
    radiusMeters: radiusMeters || 500,
    description,
    departmentsAllowed: departmentsAllowed || [],
  });

  res.status(201).json({
    success: true,
    message: 'Geofence location created',
    geofence,
  });
});

// Get all geofence locations
export const getGeofences = asyncHandler(async (req, res) => {
  const geofences = await GeofenceLocation.findActive();
  res.json({
    success: true,
    geofences,
  });
});

// Get single geofence
export const getGeofence = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const geofence = await GeofenceLocation.findById(id);
  if (!geofence) {
    return res.status(404).json({
      success: false,
      message: 'Geofence location not found',
    });
  }

  res.json({
    success: true,
    geofence,
  });
});

// Update geofence location
export const updateGeofence = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await GeofenceLocation.findById(id);
  if (!existing) {
    return res.status(404).json({
      success: false,
      message: 'Geofence location not found',
    });
  }

  const geofence = await GeofenceLocation.update(id, req.body);

  res.json({
    success: true,
    message: 'Geofence location updated',
    geofence,
  });
});

// Delete geofence location
export const deleteGeofence = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await GeofenceLocation.delete(id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Geofence location not found',
    });
  }

  res.json({
    success: true,
    message: 'Geofence location deleted',
  });
});

// Add users to "check in from anywhere" list
export const addUsersToFreeCheckIn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({
      success: false,
      message: 'userIds must be an array',
    });
  }

  const geofence = await GeofenceLocation.addFreeCheckInUsers(id, userIds);
  if (!geofence) {
    return res.status(404).json({
      success: false,
      message: 'Geofence location not found',
    });
  }

  res.json({
    success: true,
    message: 'Users added to free check-in list',
    geofence,
  });
});

// Remove users from "check in from anywhere" list
export const removeUsersFromFreeCheckIn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({
      success: false,
      message: 'userIds must be an array',
    });
  }

  const geofence = await GeofenceLocation.removeFreeCheckInUsers(id, userIds);
  if (!geofence) {
    return res.status(404).json({
      success: false,
      message: 'Geofence location not found',
    });
  }

  res.json({
    success: true,
    message: 'Users removed from free check-in list',
    geofence,
  });
});
