import api from './api';

export const geofenceService = {
  // Get all geofence locations
  getGeofences: async () => {
    const response = await api.get('/geofence');
    return response.data.geofences;
  },

  // Get single geofence
  getGeofence: async (id) => {
    const response = await api.get(`/geofence/${id}`);
    return response.data.geofence;
  },

  // Create geofence (Admin)
  createGeofence: async (data) => {
    const response = await api.post('/geofence', data);
    return response.data.geofence;
  },

  // Update geofence (Admin)
  updateGeofence: async (id, data) => {
    const response = await api.put(`/geofence/${id}`, data);
    return response.data.geofence;
  },

  // Delete geofence (Admin)
  deleteGeofence: async (id) => {
    const response = await api.delete(`/geofence/${id}`);
    return response.data;
  },

  // Add users to free check-in (Admin)
  addUsersToFreeCheckIn: async (id, userIds) => {
    const response = await api.post(`/geofence/${id}/add-free-checkin`, { userIds });
    return response.data.geofence;
  },

  // Remove users from free check-in (Admin)
  removeUsersFromFreeCheckIn: async (id, userIds) => {
    const response = await api.post(`/geofence/${id}/remove-free-checkin`, { userIds });
    return response.data.geofence;
  },

  // Check if location is within any geofence
  isWithinGeofence: (userLocation, geofences) => {
    if (!userLocation) return false;

    for (const geofence of geofences) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        geofence.latitude,
        geofence.longitude
      );

      if (distance <= geofence.radiusMeters) {
        return { within: true, location: geofence };
      }
    }

    return { within: false };
  },
};

// Haversine formula to calculate distance between two GPS coordinates
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
};

export default geofenceService;
