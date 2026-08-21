import api from './api';

export const dashboardService = {
  // One aggregated call — the stats are computed in SQL rather than
  // fetched per-employee from the client.
  getDashboard: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  },

  getActivity: async (limit = 12) => {
    const response = await api.get('/dashboard/activity', { params: { limit } });
    return response.data.activity;
  },
};

export default dashboardService;
