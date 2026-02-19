import type { MetadataRoute } from 'next';

import { getSiteUrl } from '../lib/seo.js';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/api']
      }
    ],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl
  };
}
