type AnalyticsPrimitive = string | number | boolean;

export type AnalyticsEventProps = Record<string, AnalyticsPrimitive>;

type GtagFunction = (
  command: 'js' | 'config' | 'event',
  target: Date | string,
  options?: Record<string, unknown>
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFunction;
  }
}

const envIsTruthy = (value: string | undefined): boolean | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
};

const analyticsEnabledByDefault = process.env.NODE_ENV === 'production';

const analyticsEnabled =
  envIsTruthy(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED) ?? analyticsEnabledByDefault;

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

export const analyticsConfig = {
  enabled: analyticsEnabled,
  gaMeasurementId
} as const;

const normalizeProps = (props: AnalyticsEventProps): AnalyticsEventProps => {
  return Object.entries(props).reduce<AnalyticsEventProps>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value.slice(0, 120);
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
};

export const trackAnalyticsEvent = (
  eventName: string,
  props?: AnalyticsEventProps
): void => {
  if (!analyticsConfig.enabled || analyticsConfig.gaMeasurementId.length === 0) {
    return;
  }

  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  const normalizedProps = props ? normalizeProps(props) : undefined;
  window.gtag('event', eventName, normalizedProps);
};
