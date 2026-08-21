import api from './api';

export const notificationService = {
  getMine: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  markRead: async (id) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data.notification;
  },

  markAllRead: async () => {
    await api.put('/notifications/read-all');
  },
};

export default notificationService;
