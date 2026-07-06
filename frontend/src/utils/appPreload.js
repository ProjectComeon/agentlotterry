export const routeLoaders = Object.freeze({
  login: () => import('../pages/Login'),
  adminDashboard: () => import('../pages/admin/AdminDashboard'),
  agentManagement: () => import('../pages/admin/AgentManagement'),
  customerManagement: () => import('../pages/admin/CustomerManagement'),
  adminBets: () => import('../pages/admin/AdminBets'),
  adminReports: () => import('../pages/admin/AdminReports'),
  adminLottery: () => import('../pages/admin/AdminLottery'),
  adminPendingPayouts: () => import('../pages/admin/AdminPendingPayouts'),
  agentDashboard: () => import('../pages/agent/AgentDashboard'),
  agentCustomers: () => import('../pages/agent/AgentCustomers'),
  agentMemberDetail: () => import('../pages/agent/AgentMemberDetail'),
  agentBets: () => import('../pages/agent/AgentBets'),
  agentLottery: () => import('../pages/agent/AgentLottery'),
  agentReports: () => import('../pages/agent/AgentReports'),
  agentPendingPayouts: () => import('../pages/agent/AgentPendingPayouts'),
  operatorBetting: () => import('../pages/shared/OperatorBetting'),
  memberDashboard: () => import('../pages/member/MemberDashboard'),
  memberBuy: () => import('../pages/member/MemberBuy'),
  memberSlips: () => import('../pages/member/MemberSlips'),
  memberSlipDetail: () => import('../pages/member/MemberSlipDetail'),
  memberWallet: () => import('../pages/member/MemberWallet'),
  memberPendingPayouts: () => import('../pages/member/MemberPendingPayouts'),
  memberNotifications: () => import('../pages/member/MemberNotifications')
});

const routeKeyByPath = Object.freeze({
  '/login': 'login',
  '/admin': 'adminDashboard',
  '/admin/agents': 'agentManagement',
  '/admin/customers': 'customerManagement',
  '/admin/bets': 'adminBets',
  '/admin/reports': 'adminReports',
  '/admin/lottery': 'adminLottery',
  '/admin/pending-payouts': 'adminPendingPayouts',
  '/admin/betting': 'operatorBetting',
  '/agent': 'agentDashboard',
  '/agent/customers': 'agentCustomers',
  '/agent/bets': 'agentBets',
  '/agent/reports': 'agentReports',
  '/agent/lottery': 'agentLottery',
  '/agent/pending-payouts': 'agentPendingPayouts',
  '/agent/betting': 'operatorBetting',
  '/member': 'memberDashboard',
  '/member/buy': 'memberBuy',
  '/member/slips': 'memberSlips',
  '/member/wallet': 'memberWallet',
  '/member/pending-payouts': 'memberPendingPayouts',
  '/member/notifications': 'memberNotifications'
});

const routeChunkPromises = new Map();

const cleanPath = (path = '') => {
  const rawPath = String(path || '').split('?')[0].replace(/\/+$/, '');
  return rawPath || '/';
};

const resolveRouteKey = (path, role) => {
  const normalizedPath = cleanPath(path);
  if (routeKeyByPath[normalizedPath]) return routeKeyByPath[normalizedPath];
  if (role === 'agent' && normalizedPath.startsWith('/agent/customers/')) return 'agentMemberDetail';
  if (role === 'customer' && normalizedPath.startsWith('/member/slips/')) return 'memberSlipDetail';
  return null;
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
