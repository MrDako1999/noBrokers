import axios from 'axios';

// Resolve the API base URL. In dev we leave VITE_API_URL blank and let the
// Vite proxy forward `/api` to the backend on :5001. In prod, set
// VITE_API_URL to the backend's deployed origin (no trailing slash).
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBase,
});

// Attach the JWT from localStorage on every request. We use a header (not a
// cookie) so the backend can stay stateless and Vercel's serverless cold
// starts don't need session storage.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nb-token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Only force-redirect when the user is inside the protected app shell.
      // Anonymous visits to marketing routes can absorb a 401 silently
      // (e.g. the initial /auth/me probe).
      const path = window.location.pathname;
      const insideAppShell = path.startsWith('/dashboard') || path.startsWith('/admin');
      if (insideAppShell) {
        localStorage.removeItem('nb-token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
