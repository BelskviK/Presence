import api from './api';

export const userService = {
  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data.user;
  },

  getAll: async () => {
    const response = await api.get('/auth/users');
    return response.data.users;
  },

  update: async (id, data) => {
    const response = await api.put(`/auth/users/${id}`, data);
    return response.data.user;
  },
};

export default userService;
