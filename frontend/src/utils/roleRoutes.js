const APP_ROLES = ['admin', 'agent'];

export const getAppRouteForRole = (role) => (APP_ROLES.includes(role) ? `/${role}` : '/login');

export const getValidAppRole = (role) => (APP_ROLES.includes(role) ? role : null);

