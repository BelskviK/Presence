import api from './api';

export const attendanceService = {
  // Get GPS location
  getGPSLocation: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      }
    });
  },

  // Clock in
  clockIn: async (latitude, longitude, accuracy) => {
    const response = await api.post('/attendance/clock-in', {
      latitude,
      longitude,
      accuracy,
    });
    return response.data;
  },

  // Clock out
  clockOut: async (latitude, longitude, accuracy) => {
    const response = await api.post('/attendance/clock-out', {
      latitude,
      longitude,
      accuracy,
    });
    return response.data;
  },

  // Start a break
  startBreak: async () => {
    const response = await api.post('/attendance/break-start');
    return response.data.attendance;
  },

  // End the current break
  endBreak: async () => {
    const response = await api.post('/attendance/break-end');
    return response.data.attendance;
  },

  // Get today's attendance: the current/most recent session, totals
  // aggregated across all of today's sessions, and the full session list
  // (a day can have more than one clock-in/out cycle).
  getTodayAttendance: async () => {
    const response = await api.get('/attendance/today');
    return {
      attendance: response.data.attendance,
      todaySummary: response.data.todaySummary,
      sessions: response.data.sessions,
    };
  },

  // Get attendance records
  getAttendanceRecords: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.status) params.append('status', filters.status);

    const response = await api.get(`/attendance/records?${params}`);
    return response.data.records;
  },

  // Get attendance summary
  getAttendanceSummary: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/attendance/summary?${params}`);
    return response.data.summary;
  },

  // Get active clocked in employees (Manager/Admin)
  getActiveClockedIn: async () => {
    const response = await api.get('/attendance/active-now');
    return response.data.activeClockedIn;
  },

  // Edit attendance (Manager/Admin)
  editAttendance: async (id, data) => {
    const response = await api.put(`/attendance/${id}`, data);
    return response.data.attendance;
  },
};

export default attendanceService;
