import Script from 'next/script';

import { analyticsConfig } from '../lib/analytics.js';

export function AnalyticsScript() {
  if (!analyticsConfig.enabled || analyticsConfig.provider !== 'plausible') {
    return null;
  }

  return (
    <Script
      defer
      data-domain={analyticsConfig.plausibleDomain}
      src="https://plausible.io/js/script.js"
    />
  );
}
