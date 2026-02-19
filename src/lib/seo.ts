const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const withProtocol = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `https://${value}`;
};

const normalizeSiteUrl = (value: string): string => {
  const prefixed = withProtocol(value.trim());
  const parsed = new URL(prefixed);

  if (!LOCALHOST_HOSTNAMES.has(parsed.hostname) && parsed.protocol !== 'https:') {
    parsed.protocol = 'https:';
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = '';

  return parsed.toString().replace(/\/$/, '');
};

export const getSiteUrl = (): string => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (configuredUrl) {
    return normalizeSiteUrl(configuredUrl);
  }

  return 'http://localhost:3000';
};
