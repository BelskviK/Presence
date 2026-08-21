import { create } from 'zustand';
import { authService } from '../services/authService';

export const useAuthStore = create((set, get) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: true,

  init: async () => {
    if (!authService.isAuthenticated()) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        authService.logout();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      // Couldn't verify right now (rate limit, network) — keep the session
      // from localStorage instead of logging the user out.
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const data = await authService.login(email, password);
    set({ user: data.user, isAuthenticated: true });
    return data.user;
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  hasRole: (...roles) => roles.includes(get().user?.role),
}));

export default useAuthStore;
