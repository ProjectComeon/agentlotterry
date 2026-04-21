import {
  getAdminBets,
  getAdminCustomers,
  getAdminDashboard,
  getAdminReports,
  getAgentBets,
  getAgentDashboard,
  getAgentMemberBootstrap,
  getAgentMembers,
  getAgentReports,
  getAgents,
  getCatalogLotteries,
  getCatalogOverview,
  getLotterySyncStatus,
  getMarketOverview
} from '../services/api';
import { DEFAULT_ADMIN_CUSTOMER_FILTERS, normalizeAdminCustomerFilters } from './adminCustomerFilters';
import { DEFAULT_MEMBER_LIST_FILTERS, normalizeMemberListFilters } from './memberListFilters';

const ADMIN_CUSTOMER_PAGE_LIMIT = 24;
const AGENT_MEMBER_PAGE_LIMIT = 24;
const BETS_PAGE_LIMIT = 18;
const WARM_DATA_DEDUP_MS = 20000;
const WARM_CONCURRENCY = 2;

const adminCustomerDefaultQuery = Object.freeze({
  ...normalizeAdminCustomerFilters(DEFAULT_ADMIN_CUSTOMER_FILTERS),
  paginated: '1',
  page: 1,
  limit: ADMIN_CUSTOMER_PAGE_LIMIT
});
const agentMemberDefaultQuery = Object.freeze({
  ...normalizeMemberListFilters(DEFAULT_MEMBER_LIST_FILTERS),
  paginated: '1',
  page: 1,
  limit: AGENT_MEMBER_PAGE_LIMIT
});
const betsDefaultQuery = Object.freeze({
  paginated: '1',
  page: 1,
  limit: BETS_PAGE_LIMIT
});
const reportDefaultFilters = Object.freeze({});

export const routeLoaders = Object.freeze({
  login: () => import('../pages/Login'),
  adminDashboard: () => import('../pages/admin/AdminDashboard'),
  agentManagement: () => import('../pages/admin/AgentManagement'),
  customerManagement: () => import('../pages/admin/CustomerManagement'),
  adminBets: () => import('../pages/admin/AdminBets'),
  adminReports: () => import('../pages/admin/AdminReports'),
  adminLottery: () => import('../pages/admin/AdminLottery'),
  agentDashboard: () => import('../pages/agent/AgentDashboard'),
  agentCustomers: () => import('../pages/agent/AgentCustomers'),
  agentMemberDetail: () => import('../pages/agent/AgentMemberDetail'),
  agentBets: () => import('../pages/agent/AgentBets'),
  agentLottery: () => import('../pages/agent/AgentLottery'),
  agentReports: () => import('../pages/agent/AgentReports'),
  operatorBetting: () => import('../pages/shared/OperatorBetting')
});

const routeKeyByPath = Object.freeze({
  '/login': 'login',
  '/admin': 'adminDashboard',
  '/admin/agents': 'agentManagement',
  '/admin/customers': 'customerManagement',
  '/admin/bets': 'adminBets',
  '/admin/reports': 'adminReports',
  '/admin/lottery': 'adminLottery',
  '/admin/betting': 'operatorBetting',
  '/agent': 'agentDashboard',
  '/agent/customers': 'agentCustomers',
  '/agent/bets': 'agentBets',
  '/agent/reports': 'agentReports',
  '/agent/lottery': 'agentLottery',
  '/agent/betting': 'operatorBetting'
});

const roleRouteKeys = Object.freeze({
  admin: [
    'adminDashboard',
    'operatorBetting',
    'agentManagement',
    'customerManagement',
    'adminBets',
    'adminLottery',
    'adminReports'
  ],
  agent: [
    'agentDashboard',
    'operatorBetting',
    'agentCustomers',
    'agentBets',
    'agentLottery',
    'agentReports',
    'agentMemberDetail'
  ]
});

const routeWarmersByPath = Object.freeze({
  '/admin': [() => getAdminDashboard()],
  '/admin/agents': [() => getAgents()],
  '/admin/customers': [
    () => getAdminCustomers(adminCustomerDefaultQuery),
    () => getAgents()
  ],
  '/admin/bets': [
    () => getAdminBets(betsDefaultQuery),
    () => getAgents()
  ],
  '/admin/reports': [
    () => getAdminReports(reportDefaultFilters),
    () => getAgents(),
    () => getCatalogLotteries()
  ],
  '/admin/lottery': [
    () => getCatalogOverview(),
    () => getMarketOverview(),
    () => getLotterySyncStatus()
  ],
  '/admin/betting': [],
  '/agent': [() => getAgentDashboard()],
  '/agent/customers': [
    () => getAgentMemberBootstrap(),
    () => getAgentMembers(agentMemberDefaultQuery)
  ],
  '/agent/bets': [() => getAgentBets(betsDefaultQuery)],
  '/agent/reports': [
    () => getAgentReports(reportDefaultFilters),
    () => getCatalogLotteries()
  ],
  '/agent/lottery': [
    () => getCatalogOverview(),
    () => getMarketOverview()
  ],
  '/agent/betting': [],
  '/agent/customers/:memberId': [() => getAgentMemberBootstrap()]
});

const dataWarmUntilByKey = new Map();
const routeChunkPromises = new Map();

const isBrowser = () => typeof window !== 'undefined';

const scheduleIdle = (task, { timeout = 1200, delayMs = 0 } = {}) => {
  if (!isBrowser()) return undefined;

  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      return window.requestIdleCallback(task, { timeout });
    }
    return window.setTimeout(task, 0);
  };

  if (delayMs > 0) {
    return window.setTimeout(schedule, delayMs);
  }

  return schedule();
};

const cleanPath = (path = '') => {
  const rawPath = String(path || '').split('?')[0].replace(/\/+$/, '');
  return rawPath || '/';
};

const resolveRouteKey = (path, role) => {
  const normalizedPath = cleanPath(path);
  if (routeKeyByPath[normalizedPath]) return routeKeyByPath[normalizedPath];
  if (role === 'agent' && normalizedPath.startsWith('/agent/customers/')) return 'agentMemberDetail';
  return null;
};

const resolveWarmPath = (path, role) => {
  const normalizedPath = cleanPath(path);
  if (routeWarmersByPath[normalizedPath]) return normalizedPath;
  if (role === 'agent' && normalizedPath.startsWith('/agent/customers/')) return '/agent/customers/:memberId';
  return null;
};

const shouldWarmKey = (key, ttlMs) => {
  const now = Date.now();
  if ((dataWarmUntilByKey.get(key) || 0) > now) return false;
  dataWarmUntilByKey.set(key, now + ttlMs);
  return true;
};

const runWarmers = (warmers = []) => {
  if (!warmers.length) return;

  let nextIndex = 0;
  const runNext = async () => {
    while (nextIndex < warmers.length) {
      const warmer = warmers[nextIndex];
      nextIndex += 1;
      try {
        await warmer();
      } catch {
        // Preloading must never block navigation or surface stale background errors.
      }
    }
  };

  Array.from({ length: Math.min(WARM_CONCURRENCY, warmers.length) }).forEach(() => {
    runNext();
  });
};

export const preloadRouteChunk = (routeKey) => {
  const loader = routeLoaders[routeKey];
  if (!loader) return Promise.resolve(null);
  if (!routeChunkPromises.has(routeKey)) {
    routeChunkPromises.set(routeKey, loader().catch(() => null));
  }
  return routeChunkPromises.get(routeKey);
};

export const preloadAppRouteForPath = (path, role) => {
  const routeKey = resolveRouteKey(path, role);
  return routeKey ? preloadRouteChunk(routeKey) : Promise.resolve(null);
};

export const preloadRoleRouteChunks = (role) => {
  (roleRouteKeys[role] || []).forEach((routeKey, index) => {
    scheduleIdle(() => {
      preloadRouteChunk(routeKey);
    }, { timeout: 1200, delayMs: index * 80 });
  });
};

export const warmAppRouteDataForPath = (path, role) => {
  const warmPath = resolveWarmPath(path, role);
  if (!warmPath) return;
  const warmKey = `${role || 'unknown'}:${warmPath}`;
  if (!shouldWarmKey(warmKey, WARM_DATA_DEDUP_MS)) return;

  scheduleIdle(() => {
    runWarmers(routeWarmersByPath[warmPath] || []);
  });
};
