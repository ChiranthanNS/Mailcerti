import axios from 'axios';

const api = axios.create({
  // In dev, Vite proxies /api → http://localhost:5000/api (no CORS needed)
  // In production, VITE_BACKEND_URL is set to the deployed server URL
  baseURL: import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api` : '/api',
  timeout: 60000
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mailcerti_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle session expiration (401 Unauthorized)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('mailcerti_token');
      localStorage.removeItem('mailcerti_user');
      // Redirect to home (which will show the Login page)
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
