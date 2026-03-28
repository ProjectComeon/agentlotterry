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
export const getAgentMemberBootstrap = () => api.get('/agent/config/bootstrap');
export const getAgentMembers = (params) => api.get('/agent/members', { params });
export const getAgentMemberDetail = (id) => api.get(`/agent/members/${id}`);
export const createAgentMember = (data) => api.post('/agent/members', data);
export const updateAgentMemberProfile = (id, data) => api.put(`/agent/members/${id}`, data);
export const getAgentCustomers = (params) => api.get('/agent/customers', { params });
export const createCustomer = (data) => api.post('/agent/customers', data);
export const updateCustomer = (id, data) => api.put(`/agent/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/agent/customers/${id}`);
export const getAgentBets = (params) => api.get('/agent/bets', { params });
export const getAgentReports = (params) => api.get('/agent/reports', { params });

// Wallet
export const getWalletSummary = (params) => api.get('/wallet/summary', { params });
export const getWalletHistory = (params) => api.get('/wallet/history', { params });
export const transferWalletCredit = (data) => api.post('/wallet/transfer', data);
export const adjustWalletCredit = (data) => api.post('/wallet/adjust', data);

// Member slip flow
export const parseMemberSlip = (data) => api.post('/member/slips/parse', data);
export const createMemberSlip = (data) => api.post('/member/slips', data);
export const getMemberSlips = (params) => api.get('/member/slips', { params });
export const getMemberSlip = (slipId) => api.get(`/member/slips/${slipId}`);
export const cancelMemberSlip = (slipId) => api.post(`/member/slips/${slipId}/cancel`);
export const getMemberBetItems = (params) => api.get('/member/bets', { params });
export const getMemberSummary = (params) => api.get('/member/reports/summary', { params });

// Catalog
export const getCatalogOverview = () => api.get('/catalog/overview');
export const getCatalogLotteries = () => api.get('/catalog/lotteries');
export const getCatalogRounds = (lotteryId) => api.get('/catalog/rounds', { params: { lotteryId } });
export const markCatalogAnnouncementRead = (announcementId) => api.post(`/catalog/announcements/${announcementId}/read`);

// Presence
export const sendPresenceHeartbeat = () => api.post('/presence/heartbeat');

// Results feed
export const getRecentMarketResults = (params) => api.get('/results/recent', { params });

// Lottery
export const getMarketOverview = () => api.get('/lottery/markets');
export const getLatestLottery = () => api.get('/lottery/latest');
export const getLotteryResults = () => api.get('/lottery/results');
export const fetchLottery = (data) => api.post('/lottery/fetch', data);
export const manualLottery = (data) => api.post('/lottery/manual', data);

export default api;
