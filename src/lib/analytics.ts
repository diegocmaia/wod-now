type AnalyticsPrimitive = string | number | boolean;

export type AnalyticsEventProps = Record<string, AnalyticsPrimitive>;

type PlausibleFunction = (
  eventName: string,
  options?: {
    props?: AnalyticsEventProps;
  }
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFunction;
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

const analyticsProvider = (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'plausible').toLowerCase();
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? 'wod-now.com';

export const analyticsConfig = {
  enabled: analyticsEnabled,
  provider: analyticsProvider,
  plausibleDomain
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
  if (!analyticsConfig.enabled || analyticsConfig.provider !== 'plausible') {
    return;
  }

  if (typeof window === 'undefined' || typeof window.plausible !== 'function') {
    return;
  }

  const normalizedProps = props ? normalizeProps(props) : undefined;
  window.plausible(eventName, normalizedProps ? { props: normalizedProps } : undefined);
};
