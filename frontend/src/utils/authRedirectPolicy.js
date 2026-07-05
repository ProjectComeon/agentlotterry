const AUTH_ENDPOINTS_WITH_LOCAL_HANDLING = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/me'
]);

export const normalizeUnauthorizedRequestPath = (requestUrl = '') => {
  try {
    const { pathname } = new URL(String(requestUrl), 'http://agentlottery.local');
    return pathname.replace(/^\/api(?=\/)/, '');
  } catch {
    return String(requestUrl || '').split('?')[0].replace(/^\/api(?=\/)/, '');
  }
};

export const shouldRedirectToLoginForUnauthorized = ({
  requestUrl = '',
  currentPathname = ''
} = {}) => {
  const requestPath = normalizeUnauthorizedRequestPath(requestUrl);
  if (AUTH_ENDPOINTS_WITH_LOCAL_HANDLING.has(requestPath)) {
    return false;
  }

  return currentPathname !== '/login';
};