'use client';

import { useEffect } from 'react';

import { trackAnalyticsEvent } from '../lib/analytics.js';

type WorkoutPageAnalyticsProps = {
  found: boolean;
};

export function WorkoutPageAnalytics({ found }: WorkoutPageAnalyticsProps) {
  useEffect(() => {
    trackAnalyticsEvent('workout_by_id_viewed', {
      found
    });
  }, [found]);

  return null;
}
