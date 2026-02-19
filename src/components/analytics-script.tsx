import Script from 'next/script';

import { analyticsConfig } from '../lib/analytics.js';

export function AnalyticsScript() {
  if (!analyticsConfig.enabled || analyticsConfig.gaMeasurementId.length === 0) {
    return null;
  }

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${analyticsConfig.gaMeasurementId}`}
      />
      <Script
        id="ga4-init"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${analyticsConfig.gaMeasurementId}', {
              anonymize_ip: true,
              allow_google_signals: false,
              allow_ad_personalization_signals: false
            });
          `
        }}
      />
    </>
  );
}
