# HttpOnly Cookie Auth

This phase moves the browser auth flow from localStorage bearer tokens to an httpOnly JWT cookie.

## Runtime Behavior

- POST /api/auth/login sets agentlottery_auth as an httpOnly cookie and agentlottery_csrf as a readable CSRF token cookie.
- Browser API calls use withCredentials: true and no longer send an Authorization bearer header.
- Unsafe methods (POST, PUT, PATCH, DELETE) must include X-CSRF-Token matching the CSRF cookie.
- POST /api/auth/logout clears both cookies.
- Backend bearer-token support remains for non-browser compatibility scripts while the e2e suite is migrated.

## Deployment Compatibility

Deploy backend and frontend together. The frontend expects cookie auth and CSRF cookies from login; old frontend builds that only use bearer localStorage should not be paired with this backend for browser sessions.

## Follow-Up

- Migrate backend e2e helper clients from bearer headers to cookie jars.
- Consider shorter auth cookie TTL plus refresh rotation if sessions need longer than 24 hours.
