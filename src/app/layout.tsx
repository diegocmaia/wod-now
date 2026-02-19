import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AnalyticsScript } from '../components/analytics-script';
import { getSiteUrl } from '../lib/seo.js';

type RootLayoutProps = {
  children: ReactNode;
};

const siteUrl = getSiteUrl();
const siteName = 'WOD Now';
const defaultTitle = 'WOD Now | Random CrossFit Workout Generator';
const defaultDescription =
  'Generate and share random CrossFit workouts with fast, server-rendered pages.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`
  },
  description: defaultDescription,
  alternates: {
    canonical: '/'
  },
  applicationName: siteName,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${siteName} preview image`
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/twitter-image']
  }
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsScript />
      </body>
    </html>
  );
}
