const baseUrl = process.env.SECURITY_CHECK_BASE_URL ?? 'http://127.0.0.1:3000';
const routes = ['/', '/api/workouts/random'];

const requiredHeaders = {
  'content-security-policy': (value) =>
    hasAll(value, [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ]),
  'strict-transport-security': (value) => hasAll(value, ['max-age=63072000', 'includeSubDomains']),
  'x-content-type-options': (value) => value.toLowerCase() === 'nosniff',
  'referrer-policy': (value) => value.toLowerCase() === 'strict-origin-when-cross-origin',
  'x-frame-options': (value) => value.toUpperCase() === 'DENY',
  'permissions-policy': (value) => hasAll(value, ['camera=()', 'microphone=()', 'geolocation=()'])
};

function hasAll(value, expectedParts) {
  const normalized = value.toLowerCase();
  return expectedParts.every((part) => normalized.includes(part.toLowerCase()));
}

async function checkRoute(route) {
  const response = await fetch(`${baseUrl}${route}`);
  const missing = [];
  const invalid = [];

  for (const [headerName, isValid] of Object.entries(requiredHeaders)) {
    const value = response.headers.get(headerName);
    if (!value) {
      missing.push(headerName);
      continue;
    }

    if (!isValid(value)) {
      invalid.push(`${headerName}: ${value}`);
    }
  }

  return {
    route,
    status: response.status,
    missing,
    invalid
  };
}

async function main() {
  const results = await Promise.all(routes.map((route) => checkRoute(route)));
  const failures = results.filter((result) => result.missing.length > 0 || result.invalid.length > 0);

  for (const result of results) {
    console.log(`[security-headers] ${result.route} -> status ${result.status}`);
    if (result.missing.length > 0) {
      console.error(`  missing: ${result.missing.join(', ')}`);
    }
    if (result.invalid.length > 0) {
      console.error(`  invalid: ${result.invalid.join(' | ')}`);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
    throw new Error('Security header checks failed');
  }
}

await main();
