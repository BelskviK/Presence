import api from './api';

export const leaveService = {
  submitRequest: async (data) => {
    const response = await api.post('/leave', data);
    return response.data.request;
  },

  getMyRequests: async () => {
    const response = await api.get('/leave/mine');
    return response.data.requests;
  },

  getMyBalance: async (year) => {
    const response = await api.get('/leave/balance', { params: year ? { year } : {} });
    return response.data.balances;
  },

  getAllRequests: async (status) => {
    const response = await api.get('/leave', { params: status ? { status } : {} });
    return response.data.requests;
  },

  approve: async (id, approvalNotes) => {
    const response = await api.put(`/leave/${id}/approve`, { approvalNotes });
    return response.data.request;
  },

  reject: async (id, approvalNotes) => {
    const response = await api.put(`/leave/${id}/reject`, { approvalNotes });
    return response.data.request;
  },

  cancel: async (id) => {
    const response = await api.put(`/leave/${id}/cancel`);
    return response.data.request;
  },
};

export default leaveService;
