import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const response = await api.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        useAuthStore.getState().setAccessToken(accessToken);
        if (newRefreshToken) {
          useAuthStore.getState().setRefreshToken(newRefreshToken);
        }
        processQueue(null, accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// API functions
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string; latitude?: number; longitude?: number }) =>
    api.post('/auth/login', data),
  
  logout: () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    return api.post('/auth/logout', { refreshToken });
  },
  
  refresh: () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    return api.post('/auth/refresh', { refreshToken });
  },
  
  verifySession: (sessionId: string, token: string) =>
    api.post('/auth/verify-session', { sessionId, verificationToken: token }),
  
  me: () => api.get('/auth/me'),
  
  // Test endpoints for token theft simulation
  saveTokenForTest: () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    return api.post('/auth/test/save-token', { refreshToken });
  },
  
  simulateTokenTheft: () => api.post('/auth/test/simulate-theft'),
  
  // Test endpoints for suspicious login
  getDeviceInfo: () => api.get('/auth/test/device-info'),
  
  clearKnownLocations: () => api.post('/auth/test/clear-locations'),
  
  simulateSuspiciousLogin: (data: { country?: string; ipAddress?: string }) =>
    api.post('/auth/test/simulate-suspicious', data),
  
  addKnownLocation: (data: { country?: string; ipAddress?: string }) =>
    api.post('/auth/test/add-location', data),
};

export const sessionApi = {
  getSessions: () => api.get('/sessions'),
  
  deleteSession: (id: string) => api.delete(`/sessions/${id}`),
  
  deleteOtherSessions: () => api.delete('/sessions/other'),
  
  deleteAllSessions: () => api.delete('/sessions'),
};

export const adminApi = {
  getAllSessions: () => api.get('/admin/sessions'),
  
  getAllUsers: () => api.get('/admin/users'),
  
  forceLogoutUser: (userId: string) =>
    api.delete(`/admin/users/${userId}/sessions`),
  
  forceLogoutSession: (sessionId: string) =>
    api.delete(`/admin/sessions/${sessionId}`),
};
