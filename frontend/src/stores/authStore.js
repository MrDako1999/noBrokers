import { create } from 'zustand';
import api from '@/lib/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,

  // Probe /auth/me on app boot. Anonymous visitors get a 401 which we
  // silently absorb — that's the normal path for the marketing pages.
  checkAuth: async () => {
    const token = localStorage.getItem('nb-token');
    if (!token) {
      set({ user: null, isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isLoading: false });
    } catch {
      localStorage.removeItem('nb-token');
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('nb-token', data.token);
    set({ user: data.user });
    return data;
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('nb-token', data.token);
    set({ user: data.user });
    return data;
  },

  logout: () => {
    localStorage.removeItem('nb-token');
    set({ user: null });
  },

  refreshUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user });
      return data.user;
    } catch (err) {
      console.error('refreshUser failed', err);
      return null;
    }
  },

  updateProfile: async (payload) => {
    const { data } = await api.put('/auth/profile', payload);
    set({ user: data.user });
    return data.user;
  },

  isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
