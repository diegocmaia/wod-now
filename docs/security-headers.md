# Security Headers Policy

This project enforces baseline browser security headers on all routes (`/:path*`), including app pages and API responses.

## Required headers
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `X-Frame-Options`
- `Permissions-Policy`

`x-powered-by` is disabled.

## CSP directives and current exceptions
Current CSP:
- `default-src 'self'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'none'`
- `object-src 'none'`
- `script-src 'self' 'unsafe-inline' https://plausible.io`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:`
- `font-src 'self' data:`
- `connect-src 'self' https://plausible.io`
- `upgrade-insecure-requests`

Documented exceptions:
- `script-src 'unsafe-inline'`: required for current Next.js runtime inline scripts.
- `style-src 'unsafe-inline'`: required for framework-injected inline styles.
- `img-src data: blob:` and `font-src data:`: support local data/blob assets used by the app/runtime.
- `script-src/connect-src https://plausible.io`: required for Plausible analytics script loading and event delivery.

No cookies are issued by this app today; if cookies are introduced later, they must use `Secure`, `HttpOnly`, and `SameSite` defaults unless there is a documented exception.

## Verification
Run the checker against a running app server:

```bash
npm run check:security-headers
```

Or with a custom base URL:

```bash
SECURITY_CHECK_BASE_URL=http://127.0.0.1:3100 npm run check:security-headers
```

CI runs this check via `.github/workflows/security-headers.yml`.
