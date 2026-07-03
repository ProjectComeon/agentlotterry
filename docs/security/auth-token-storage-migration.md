# Auth Token Storage Migration Plan

## Current Risk

The frontend stores the bearer token in localStorage and attaches it to API requests as an Authorization header.
Relevant locations:

- frontend/src/context/AuthContext.jsx
- frontend/src/services/api.js
- frontend/src/utils/authBootstrap.js
- frontend/src/utils/apiReadCache.js

This keeps the token readable by any script that runs in the browser context. Any future XSS would become account takeover instead of only UI compromise.

## Recommended Target

Move authentication to an httpOnly, Secure, SameSite cookie session issued by the backend. Keep access/session identifiers out of localStorage. The API should authenticate from the cookie and the frontend should call APIs with credentials enabled.

Recommended shape:

1. Backend login sets an httpOnly Secure SameSite=Lax session cookie.
2. Backend logout clears the cookie.
3. Frontend removes token persistence and uses cookie-backed requests with axios withCredentials.
4. Add CSRF protection for unsafe methods. Use a double-submit CSRF token or server-issued non-httpOnly CSRF cookie paired with an X-CSRF-Token header.
5. Keep only non-sensitive display user data in memory or short-lived storage; revalidate with /api/auth/me on app boot.
6. Rotate session identifiers on login and privilege-sensitive events.
7. Add server-side session invalidation for disabled/suspended users.

## Incremental Rollout

- Phase 1: Add cookie auth endpoints alongside the current bearer-token flow.
- Phase 2: Update frontend API client to prefer cookie auth and stop writing token to localStorage.
- Phase 3: Add CSRF middleware to protected unsafe routes and update frontend write calls.
- Phase 4: Migrate e2e smoke/regression to cookie login.
- Phase 5: Remove bearer-token localStorage fallback after deployment soak.

## Issue-Ready Follow-Up

Severity: High if any XSS is introduced; Medium under current code because no direct XSS sink was confirmed in this pass.

Acceptance criteria:

- No JWT or bearer token is written to localStorage/sessionStorage.
- Authenticated browser requests work with httpOnly cookies.
- Unsafe API methods require CSRF validation.
- e2e smoke/regression covers login, logout, /auth/me, admin/agent API requests, and disabled account handling.

## Phase 1 Implementation Status

Implemented in codex/http-only-cookie-auth:

- Browser login now receives an httpOnly `agentlottery_auth` cookie and readable `agentlottery_csrf` cookie.
- Frontend API calls use `withCredentials: true` and do not persist or send bearer tokens from localStorage.
- Unsafe browser requests send `X-CSRF-Token` from the CSRF cookie.
- Logout calls the backend and clears auth cookies server-side.
- Existing backend e2e scripts keep a temporary explicit bearer compatibility header while those scripts are migrated to cookie jars.

Remaining follow-up:

- Remove bearer response compatibility after non-browser clients and e2e helpers move to cookie sessions or a separate service-token flow.
- Consider session rotation/refresh if 24-hour JWT cookies are not sufficient operationally.
