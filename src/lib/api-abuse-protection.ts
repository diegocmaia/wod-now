import { jsonError } from './api-error.js';

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitResult =
  | {
      blocked: false;
      headers: Headers;
    }
  | {
      blocked: true;
      response: Response;
    };

type RateLimitState = {
  windowStart: number;
  count: number;
};

type AdminAuthState = {
  failures: number;
  lockoutUntilMs: number;
};

const rateLimitStore = new Map<string, RateLimitState>();
const adminAuthStore = new Map<string, AdminAuthState>();

const DEFAULT_PUBLIC_RATE_LIMIT_PER_MINUTE = 60;
const DEFAULT_ADMIN_RATE_LIMIT_PER_MINUTE = 12;
const DEFAULT_ADMIN_AUTH_FAILURE_THRESHOLD = 5;
const DEFAULT_ADMIN_LOCKOUT_BASE_SECONDS = 30;
const DEFAULT_ADMIN_LOCKOUT_MAX_SECONDS = 900;
const DEFAULT_ADMIN_REQUEST_MAX_BYTES = 64 * 1024;
const DEFAULT_PUBLIC_REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_ADMIN_REQUEST_TIMEOUT_MS = 2500;
const DEFAULT_MAX_URL_LENGTH = 2048;
const ONE_MINUTE_MS = 60_000;

const suspiciousUserAgentTokens = [
  'sqlmap',
  'nikto',
  'masscan',
  'nmap',
  'acunetix',
  'nessus',
  'zgrab',
  'gobuster',
  'dirbuster',
  'ffuf'
];

const suspiciousPathTokens = [
  '../',
  '..%2f',
  '<script',
  'union%20select',
  'or%201=1',
  '%00',
  '/.env',
  '/wp-admin',
  '/phpmyadmin'
];

const parsePositiveInt = (rawValue: string | undefined, fallback: number): number => {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
};

const getClientIp = (request: Request): string => {
  const candidate =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip');

  if (!candidate) {
    return 'unknown';
  }

  return candidate
    .split(',')[0]
    .trim()
    .slice(0, 128) || 'unknown';
};

const isSuspiciousRequest = (request: Request): boolean => {
  const userAgent = (request.headers.get('user-agent') ?? '').toLowerCase();
  const pathAndQuery = request.url.toLowerCase();

  return (
    suspiciousUserAgentTokens.some((token) => userAgent.includes(token)) ||
    suspiciousPathTokens.some((token) => pathAndQuery.includes(token))
  );
};

const validateUrlLength = (request: Request): Response | null => {
  const maxUrlLength = parsePositiveInt(
    process.env.API_MAX_URL_LENGTH,
    DEFAULT_MAX_URL_LENGTH
  );

  if (request.url.length > maxUrlLength) {
    return jsonError(414, 'URI_TOO_LONG', 'Request URL is too long');
  }

  return null;
};

const validateRequestBodySize = (
  request: Request,
  maxBytes: number
): Response | null => {
  const rawSize = request.headers.get('content-length');
  if (!rawSize) {
    return null;
  }

  const size = Number(rawSize);
  if (!Number.isFinite(size) || size < 0) {
    return jsonError(400, 'BAD_REQUEST', 'Invalid content-length header');
  }

  if (size > maxBytes) {
    return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds maximum allowed size');
  }

  return null;
};

const buildRateLimitHeaders = (
  config: RateLimitConfig,
  state: RateLimitState,
  nowMs: number
): Headers => {
  const resetSeconds = Math.max(
    1,
    Math.ceil((state.windowStart + config.windowMs - nowMs) / 1000)
  );
  const remaining = Math.max(config.limit - state.count, 0);
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', String(config.limit));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(resetSeconds));
  return headers;
};

const applyRateLimit = (
  key: string,
  config: RateLimitConfig,
  nowMs: number
): RateLimitResult => {
  const existing = rateLimitStore.get(key);
  if (!existing || nowMs - existing.windowStart >= config.windowMs) {
    const freshState: RateLimitState = {
      windowStart: nowMs,
      count: 1
    };
    rateLimitStore.set(key, freshState);
    return { blocked: false, headers: buildRateLimitHeaders(config, freshState, nowMs) };
  }

  if (existing.count >= config.limit) {
    const retrySeconds = Math.max(
      1,
      Math.ceil((existing.windowStart + config.windowMs - nowMs) / 1000)
    );
    const headers = buildRateLimitHeaders(config, existing, nowMs);
    headers.set('Retry-After', String(retrySeconds));
    return {
      blocked: true,
      response: jsonError(
        429,
        'RATE_LIMITED',
        'Too many requests. Please retry later.',
        undefined,
        headers
      )
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { blocked: false, headers: buildRateLimitHeaders(config, existing, nowMs) };
};

const buildPublicRouteKey = (request: Request): string => {
  const route = new URL(request.url).pathname;
  return `public:${route}:${getClientIp(request)}`;
};

const buildAdminRouteKey = (request: Request): string => {
  return `admin:${getClientIp(request)}`;
};

const getPublicRateConfig = (): RateLimitConfig => ({
  limit: parsePositiveInt(
    process.env.API_PUBLIC_RATE_LIMIT_PER_MINUTE,
    DEFAULT_PUBLIC_RATE_LIMIT_PER_MINUTE
  ),
  windowMs: ONE_MINUTE_MS
});

const getAdminRateConfig = (): RateLimitConfig => ({
  limit: parsePositiveInt(
    process.env.API_ADMIN_RATE_LIMIT_PER_MINUTE,
    DEFAULT_ADMIN_RATE_LIMIT_PER_MINUTE
  ),
  windowMs: ONE_MINUTE_MS
});

const getAdminLockoutFailureThreshold = (): number =>
  parsePositiveInt(
    process.env.API_ADMIN_AUTH_FAILURE_THRESHOLD,
    DEFAULT_ADMIN_AUTH_FAILURE_THRESHOLD
  );

const getAdminLockoutBaseSeconds = (): number =>
  parsePositiveInt(
    process.env.API_ADMIN_LOCKOUT_BASE_SECONDS,
    DEFAULT_ADMIN_LOCKOUT_BASE_SECONDS
  );

const getAdminLockoutMaxSeconds = (): number =>
  parsePositiveInt(
    process.env.API_ADMIN_LOCKOUT_MAX_SECONDS,
    DEFAULT_ADMIN_LOCKOUT_MAX_SECONDS
  );

const getPublicTimeoutMs = (): number =>
  parsePositiveInt(
    process.env.API_PUBLIC_REQUEST_TIMEOUT_MS,
    DEFAULT_PUBLIC_REQUEST_TIMEOUT_MS
  );

const getAdminTimeoutMs = (): number =>
  parsePositiveInt(
    process.env.API_ADMIN_REQUEST_TIMEOUT_MS,
    DEFAULT_ADMIN_REQUEST_TIMEOUT_MS
  );

const getAdminMaxBodyBytes = (): number =>
  parsePositiveInt(
    process.env.API_ADMIN_REQUEST_MAX_BYTES,
    DEFAULT_ADMIN_REQUEST_MAX_BYTES
  );

const getAdminState = (key: string): AdminAuthState => {
  return (
    adminAuthStore.get(key) ?? {
      failures: 0,
      lockoutUntilMs: 0
    }
  );
};

const setAdminState = (key: string, state: AdminAuthState): void => {
  adminAuthStore.set(key, state);
};

export const applyRateLimitHeaders = (
  response: Response,
  rateLimitHeaders: Headers
): Response => {
  const headers = new Headers(response.headers);
  rateLimitHeaders.forEach((value, name) => {
    headers.set(name, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

export const enforcePublicApiProtections = (
  request: Request
): { rateLimitHeaders: Headers } | { response: Response } => {
  const longUrlResponse = validateUrlLength(request);
  if (longUrlResponse) {
    return { response: longUrlResponse };
  }

  if (isSuspiciousRequest(request)) {
    return {
      response: jsonError(403, 'BOT_BLOCKED', 'Request blocked by abuse protections')
    };
  }

  const nowMs = Date.now();
  const rateLimitResult = applyRateLimit(
    buildPublicRouteKey(request),
    getPublicRateConfig(),
    nowMs
  );

  if (rateLimitResult.blocked) {
    return { response: rateLimitResult.response };
  }

  return { rateLimitHeaders: rateLimitResult.headers };
};

export const enforceAdminRoutePreAuth = (
  request: Request
): { key: string; rateLimitHeaders: Headers } | { response: Response } => {
  const longUrlResponse = validateUrlLength(request);
  if (longUrlResponse) {
    return { response: longUrlResponse };
  }

  if (isSuspiciousRequest(request)) {
    return {
      response: jsonError(403, 'BOT_BLOCKED', 'Request blocked by abuse protections')
    };
  }

  const largeBodyResponse = validateRequestBodySize(request, getAdminMaxBodyBytes());
  if (largeBodyResponse) {
    return { response: largeBodyResponse };
  }

  const key = buildAdminRouteKey(request);
  const nowMs = Date.now();

  const state = getAdminState(key);
  if (state.lockoutUntilMs > nowMs) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.lockoutUntilMs - nowMs) / 1000)
    );
    const headers = new Headers();
    headers.set('Retry-After', String(retryAfterSeconds));
    return {
      response: jsonError(
        429,
        'ADMIN_LOCKED',
        'Too many invalid admin authentication attempts. Please retry later.',
        undefined,
        headers
      )
    };
  }

  const rateLimitResult = applyRateLimit(key, getAdminRateConfig(), nowMs);
  if (rateLimitResult.blocked) {
    return { response: rateLimitResult.response };
  }

  return { key, rateLimitHeaders: rateLimitResult.headers };
};

export const registerAdminAuthFailure = (
  key: string
): { response: Response } => {
  const nowMs = Date.now();
  const state = getAdminState(key);
  const failures = state.failures + 1;
  const threshold = getAdminLockoutFailureThreshold();
  const failuresPastThreshold = Math.max(failures - threshold, 0);

  let lockoutSeconds = 0;
  if (failures >= threshold) {
    lockoutSeconds = Math.min(
      getAdminLockoutMaxSeconds(),
      getAdminLockoutBaseSeconds() * 2 ** failuresPastThreshold
    );
  }

  const nextState: AdminAuthState = {
    failures,
    lockoutUntilMs: lockoutSeconds > 0 ? nowMs + lockoutSeconds * 1000 : 0
  };
  setAdminState(key, nextState);

  if (lockoutSeconds > 0) {
    const headers = new Headers();
    headers.set('Retry-After', String(lockoutSeconds));
    return {
      response: jsonError(
        429,
        'ADMIN_LOCKED',
        'Too many invalid admin authentication attempts. Please retry later.',
        undefined,
        headers
      )
    };
  }

  return {
    response: jsonError(401, 'UNAUTHORIZED', 'Missing or invalid admin API key')
  };
};

export const clearAdminAuthFailureState = (key: string): void => {
  setAdminState(key, {
    failures: 0,
    lockoutUntilMs: 0
  });
};

export const withApiTimeout = async <T>(
  task: Promise<T>,
  scope: 'public' | 'admin'
): Promise<T> => {
  const timeoutMs = scope === 'admin' ? getAdminTimeoutMs() : getPublicTimeoutMs();
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('API_REQUEST_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const toTimeoutErrorResponse = (): Response => {
  return jsonError(503, 'REQUEST_TIMEOUT', 'Request timed out. Please retry.');
};

export const resetApiAbuseProtectionStateForTests = (): void => {
  rateLimitStore.clear();
  adminAuthStore.clear();
};
