const APP_ROLES = ['admin', 'agent', 'customer'];

const ROLE_HOME = {
  admin: '/admin',
  agent: '/agent',
  customer: '/member'
};

export const getAppRouteForRole = (role) => ROLE_HOME[role] || '/login';

export const getValidAppRole = (role) => (APP_ROLES.includes(role) ? role : null);
