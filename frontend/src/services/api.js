import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Admin
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAgents = () => api.get('/admin/agents');
export const createAgent = (data) => api.post('/admin/agents', data);
export const updateAgent = (id, data) => api.put(`/admin/agents/${id}`, data);
export const deleteAgent = (id) => api.delete(`/admin/agents/${id}`);
export const getAdminCustomers = (agentId) => api.get(`/admin/customers${agentId ? `?agentId=${agentId}` : ''}`);
export const createAdminCustomer = (data) => api.post('/admin/customers', data);
export const updateAdminCustomer = (id, data) => api.put(`/admin/customers/${id}`, data);
export const deleteAdminCustomer = (id) => api.delete(`/admin/customers/${id}`);
export const getAdminReports = (params) => api.get('/admin/reports', { params });

// Agent
export const getAgentDashboard = () => api.get('/agent/dashboard');
export const getAgentCustomers = () => api.get('/agent/customers');
export const createCustomer = (data) => api.post('/agent/customers', data);
export const updateCustomer = (id, data) => api.put(`/agent/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/agent/customers/${id}`);
export const getAgentBets = (params) => api.get('/agent/bets', { params });
export const getAgentReports = (params) => api.get('/agent/reports', { params });

// Customer
export const placeBets = (data) => api.post('/customer/bets', data);
export const getCustomerBets = (params) => api.get('/customer/bets', { params });
export const getCustomerSummary = (params) => api.get('/customer/summary', { params });

// Lottery
export const getLatestLottery = () => api.get('/lottery/latest');
export const getLotteryResults = () => api.get('/lottery/results');
export const fetchLottery = (data) => api.post('/lottery/fetch', data);
export const manualLottery = (data) => api.post('/lottery/manual', data);
export const calculateLottery = (data) => api.post('/lottery/calculate', data);

export default api;
