import axios from 'axios';
import { buildReadCacheKey } from '../utils/apiReadCache';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});
const buildNoCacheConfig = (params = {}) => ({
  params: {
    ...params,
    _t: Date.now()
  },
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
});
const READ_CACHE_DEFAULT_TTL_MS = Number(import.meta.env.VITE_API_READ_CACHE_MS || 15000);
const READ_TTL_SHORT_MS = 5000;
const READ_TTL_MEDIUM_MS = 15000;
const READ_TTL_LONG_MS = 60000;
const readCache = new Map();

export const clearApiReadCache = () => {
  readCache.clear();
};

const clearCacheAfterWrite = async (request) => {
  const response = await request;
  clearApiReadCache();
  return response;
};

const cachedGet = (url, { params = {}, ttlMs = READ_CACHE_DEFAULT_TTL_MS, force = false } = {}) => {
  const cacheKey = buildReadCacheKey({
    token: localStorage.getItem('token') || '',
    url,
    params
  });
  const now = Date.now();
  const cached = readCache.get(cacheKey);

  if (!force && cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const request = api.get(
    url,
    force ? buildNoCacheConfig(params) : { params }
  ).catch((error) => {
    readCache.delete(cacheKey);
    throw error;
  });

  readCache.set(cacheKey, {
    expiresAt: now + Math.max(0, ttlMs),
    promise: request
  });

  return request;
};

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
      clearApiReadCache();
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
export const getAdminDashboard = (options = {}) => cachedGet('/admin/dashboard', {
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const getAgents = (options = {}) => cachedGet('/admin/agents', {
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const createAgent = (data) => clearCacheAfterWrite(api.post('/admin/agents', data));
export const updateAgent = (id, data) => clearCacheAfterWrite(api.put(`/admin/agents/${id}`, data));
export const deleteAgent = (id) => clearCacheAfterWrite(api.delete(`/admin/agents/${id}`));
export const getAdminCustomers = (paramsOrAgentId = '', options = {}) => {
  const params = paramsOrAgentId && typeof paramsOrAgentId === 'object'
    ? paramsOrAgentId
    : { agentId: paramsOrAgentId };

  return cachedGet('/admin/customers', {
    params,
    ttlMs: READ_TTL_MEDIUM_MS,
    force: Boolean(options.force)
  });
};
export const getAdminMemberBootstrap = (agentId, options = {}) => cachedGet('/admin/customers/bootstrap', {
  params: { agentId },
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const getAdminCustomerDetail = (id, options = {}) => cachedGet(`/admin/customers/${id}`, {
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const createAdminCustomer = (data) => clearCacheAfterWrite(api.post('/admin/customers', data));
export const updateAdminCustomer = (id, data) => clearCacheAfterWrite(api.put(`/admin/customers/${id}`, data));
export const deleteAdminCustomer = (id) => clearCacheAfterWrite(api.delete(`/admin/customers/${id}`));
export const getAdminBets = (params, options = {}) => cachedGet('/admin/bets', {
  params,
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const getAdminReports = (params, options = {}) => cachedGet('/admin/reports', {
  params,
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const searchAdminBettingMembers = (params) => api.get('/admin/betting/members/search', { params });
export const getAdminBettingMemberContext = (memberId, options = {}) => cachedGet(`/admin/betting/members/${memberId}/context`, {
  params: {
    ...(options.params || {}),
    ...(options.includeCatalog === false ? { includeCatalog: '0' } : {})
  },
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const parseAdminBettingSlip = (data) => api.post('/admin/betting/slips/parse', data);
export const createAdminBettingSlip = (data) => clearCacheAfterWrite(api.post('/admin/betting/slips', data));
export const cancelAdminBettingSlip = (slipId) => clearCacheAfterWrite(api.post(`/admin/betting/slips/${slipId}/cancel`));
export const getAdminRecentBettingItems = (params, options = {}) => cachedGet('/admin/betting/items/recent', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const getAdminBettingDraft = (params) => api.get('/admin/betting/draft', { params });
export const saveAdminBettingDraft = (data) => api.put('/admin/betting/draft', data);
export const clearAdminBettingDraft = (data) => api.delete('/admin/betting/draft', { data });

// Agent
export const getAgentDashboard = (options = {}) => cachedGet('/agent/dashboard', {
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const getAgentMemberBootstrap = (options = {}) => cachedGet('/agent/config/bootstrap', {
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const getAgentMembers = (params, options = {}) => cachedGet('/agent/members', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const getAgentMemberDetail = (id, options = {}) => cachedGet(`/agent/members/${id}`, {
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const createAgentMember = (data) => clearCacheAfterWrite(api.post('/agent/members', data));
export const updateAgentMemberProfile = (id, data) => clearCacheAfterWrite(api.put(`/agent/members/${id}`, data));
export const getAgentCustomers = (params, options = {}) => cachedGet('/agent/customers', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const createCustomer = (data) => clearCacheAfterWrite(api.post('/agent/customers', data));
export const updateCustomer = (id, data) => clearCacheAfterWrite(api.put(`/agent/customers/${id}`, data));
export const deleteCustomer = (id) => clearCacheAfterWrite(api.delete(`/agent/customers/${id}`));
export const getAgentBets = (params, options = {}) => cachedGet('/agent/bets', {
  params,
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const getAgentReports = (params, options = {}) => cachedGet('/agent/reports', {
  params,
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const searchAgentBettingMembers = (params) => api.get('/agent/betting/members/search', { params });
export const getAgentBettingMemberContext = (memberId, options = {}) => cachedGet(`/agent/betting/members/${memberId}/context`, {
  params: {
    ...(options.params || {}),
    ...(options.includeCatalog === false ? { includeCatalog: '0' } : {})
  },
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const parseAgentBettingSlip = (data) => api.post('/agent/betting/slips/parse', data);
export const createAgentBettingSlip = (data) => clearCacheAfterWrite(api.post('/agent/betting/slips', data));
export const cancelAgentBettingSlip = (slipId) => clearCacheAfterWrite(api.post(`/agent/betting/slips/${slipId}/cancel`));
export const getAgentRecentBettingItems = (params, options = {}) => cachedGet('/agent/betting/items/recent', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const getAgentBettingDraft = (params) => api.get('/agent/betting/draft', { params });
export const saveAgentBettingDraft = (data) => api.put('/agent/betting/draft', data);
export const clearAgentBettingDraft = (data) => api.delete('/agent/betting/draft', { data });

// Wallet
export const getWalletSummary = (params, options = {}) => cachedGet('/wallet/summary', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const getWalletHistory = (params, options = {}) => cachedGet('/wallet/history', {
  params,
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const transferWalletCredit = (data) => clearCacheAfterWrite(api.post('/wallet/transfer', data));
export const adjustWalletCredit = (data) => clearCacheAfterWrite(api.post('/wallet/adjust', data));

// Member slip flow
export const parseMemberSlip = (data) => api.post('/member/slips/parse', data);
export const createMemberSlip = (data) => api.post('/member/slips', data);
export const getMemberSlips = (params) => api.get('/member/slips', { params });
export const getMemberSlip = (slipId) => api.get(`/member/slips/${slipId}`);
export const cancelMemberSlip = (slipId) => api.post(`/member/slips/${slipId}/cancel`);
export const getMemberBetItems = (params) => api.get('/member/bets', { params });
export const getMemberSummary = (params) => api.get('/member/reports/summary', { params });

// Catalog
export const getCatalogOverview = (options = {}) => cachedGet('/catalog/overview', {
  params: {
    ...(options.variant ? { variant: options.variant } : {}),
    ...(typeof options.includeAnnouncements === 'boolean' ? { includeAnnouncements: String(options.includeAnnouncements) } : {}),
    ...(typeof options.includeRecentResults === 'boolean' ? { includeRecentResults: String(options.includeRecentResults) } : {}),
    ...(options.force ? { force: '1' } : {})
  },
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const getCatalogLotteries = (options = {}) => cachedGet('/catalog/lotteries', {
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const getCatalogRounds = (lotteryId, options = {}) => cachedGet('/catalog/rounds', {
  params: { lotteryId },
  ttlMs: READ_TTL_SHORT_MS,
  force: Boolean(options.force)
});
export const markCatalogAnnouncementRead = async (announcementId) => {
  const response = await api.post(`/catalog/announcements/${announcementId}/read`);
  clearApiReadCache();
  return response;
};

// Presence
export const sendPresenceHeartbeat = () => api.post('/presence/heartbeat');

// Results feed
export const getRecentMarketResults = (params, options = {}) => cachedGet('/results/recent', {
  params,
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});

// Lottery
export const getMarketOverview = (options = {}) => cachedGet('/lottery/markets', {
  ttlMs: READ_TTL_LONG_MS,
  force: Boolean(options.force)
});
export const getLotterySyncStatus = (options = {}) => cachedGet('/lottery/sync-status', {
  ttlMs: READ_TTL_MEDIUM_MS,
  force: Boolean(options.force)
});
export const syncLatestLottery = async () => {
  const response = await api.post('/lottery/sync-latest');
  clearApiReadCache();
  return response;
};
export const getLatestLottery = () => api.get('/lottery/latest');
export const getLotteryResults = () => api.get('/lottery/results');
export const fetchLottery = async (data) => {
  const response = await api.post('/lottery/fetch', data);
  clearApiReadCache();
  return response;
};
export const manualLottery = async (data) => {
  const response = await api.post('/lottery/manual', data);
  clearApiReadCache();
  return response;
};
export const updateRoundClosedBetTypes = async (roundId, data) => {
  const response = await api.put(`/lottery/rounds/${roundId}/closed-bet-types`, data);
  clearApiReadCache();
  return response;
};
export const updateRoundBettingOverride = async (roundId, data) => {
  const response = await api.put(`/lottery/rounds/${roundId}/betting-override`, data);
  clearApiReadCache();
  return response;
};
export const updateRoundTiming = async (roundId, data) => {
  const response = await api.put(`/lottery/rounds/${roundId}/timing`, data);
  clearApiReadCache();
  return response;
};
export const reconcileLotteryRoundSettlement = (roundId) => api.get(`/lottery/rounds/${roundId}/settlement/reconcile`);
export const reverseLotteryRoundSettlement = async (roundId) => {
  const response = await api.post(`/lottery/rounds/${roundId}/settlement/reverse`);
  clearApiReadCache();
  return response;
};
export const rerunLotteryRoundSettlement = async (roundId) => {
  const response = await api.post(`/lottery/rounds/${roundId}/settlement/rerun`);
  clearApiReadCache();
  return response;
};

export default api;
