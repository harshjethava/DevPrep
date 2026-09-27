import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const hasAuthHeader = Boolean(
      config.headers && (config.headers.Authorization || config.headers.authorization)
    );
    // Only attach the legacy JWT token if it is a real non-empty string.
    // Prevents "Authorization: Bearer null" when no JWT is stored.
    if (token && token !== 'null' && token !== 'undefined' && !hasAuthHeader) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

/* ── Auth ── */
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
  verifyEmail: (params) => api.get('/auth/verify-email', { params }),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data)
};

/* ── Clerk ── */
export const clerkAPI = {
  syncMe: (clerkToken) =>
    api.post('/clerk/sync/me', {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProfile: (clerkToken) =>
    api.get('/clerk/profile', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  updateProfile: (clerkToken, data) =>
    api.put('/clerk/profile', data, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Questions ── */
export const questionsAPI = {
  generate: (clerkToken, payload) =>
    api.post('/questions/generate', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  save: (clerkToken, payload) =>
    api.post('/questions/save', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getSavedStats: (clerkToken) =>
    api.get('/questions/saved/stats', { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Mock Interview ── */
export const mockInterviewAPI = {
  start: (clerkToken, payload) =>
    api.post('/mock-interviews/start', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getSession: (clerkToken, sessionId) =>
    api.get(`/mock-interviews/${sessionId}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  sendMessage: (clerkToken, sessionId, content) =>
    api.post(`/mock-interviews/${sessionId}/message`, { content }, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  endSession: (clerkToken, sessionId, status = 'completed') =>
    api.post(`/mock-interviews/${sessionId}/end`, { status }, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getHistory: (clerkToken) =>
    api.get('/mock-interviews/history', { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Resume ── */
export const resumeAPI = {
  upload: (clerkToken, formData) =>
    api.post('/resume/upload', formData, {
      headers: { Authorization: `Bearer ${clerkToken}`, 'Content-Type': 'multipart/form-data' }
    }),
  getResume: (clerkToken) =>
    api.get('/resume', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  deleteResume: (clerkToken, id) =>
    api.delete(`/resume/${id}`, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Coding ── */
export const codingAPI = {
  listProblems: (clerkToken, params = {}) =>
    api.get('/coding/problems', { params, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProblem: (clerkToken, id) =>
    api.get(`/coding/problems/${id}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  runCode: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/run`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  submitSolution: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/submit`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  saveDraft: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/save-draft`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getStatus: (clerkToken, id) =>
    api.get(`/coding/problems/${id}/status`, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Analytics ── */
export const analyticsAPI = {
  getOverview: (clerkToken) =>
    api.get('/analytics/overview', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getPerformance: (clerkToken) =>
    api.get('/analytics/performance', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getTopics: (clerkToken) =>
    api.get('/analytics/topics', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getCodingStats: (clerkToken) =>
    api.get('/analytics/coding-stats', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getSubmissionActivity: (clerkToken) =>
    api.get('/analytics/submission-activity', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getStreak: (clerkToken) =>
    api.get('/analytics/streak', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProfileInsights: (clerkToken) =>
    api.get('/analytics/profile-insights', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getRecentActivity: (clerkToken) =>
    api.get('/analytics/recent-activity', { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Users (public search) ── */
export const userAPI = {
  search: (query) => api.get('/users/search', { params: { q: query } }),
  getPublicProfile: (username) => api.get(`/users/public/${username}`),
  getPublicAnalytics: (username) => api.get(`/users/public/${username}/analytics`)
};
