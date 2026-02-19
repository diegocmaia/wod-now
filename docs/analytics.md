# Product Analytics Baseline

This project uses Google Analytics 4 (GA4) with privacy-first defaults.

## Why GA4
- Free hosted analytics.
- Built-in users, sessions, and page views.
- Supports custom events for product behavior.
- Works with minimal frontend integration.

## Privacy Defaults
- `anonymize_ip` enabled.
- `allow_google_signals` disabled.
- `allow_ad_personalization_signals` disabled.
- No `user_id` is set.
- No PII should be sent in event names or parameters.

## Configuration
Environment variables:
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`:
  - Required GA4 measurement ID (example `G-XXXXXXXXXX`).
- `NEXT_PUBLIC_ANALYTICS_ENABLED`:
  - Optional explicit toggle.
  - `true`/`false`, `1`/`0`, `on`/`off`.
  - If not set: enabled in production, disabled locally.

## Event Taxonomy
All events avoid PII and avoid user identifiers.

- `random_workout_requested`
  - Trigger: user clicks "Get random workout".
  - Params:
    - `has_time_cap_filter` (boolean)
    - `equipment_count` (number)
    - `exclude_count` (number)
- `workout_rendered`
  - Trigger: random workout successfully rendered.
  - Params:
    - `source` (`random`)
    - `equipment_count` (number)
    - `time_cap_seconds` (number)
- `workout_by_id_viewed`
  - Trigger: `/wod/[id]` page rendered.
  - Params:
    - `found` (boolean)
- `api_error`
  - Trigger: client-observed API failures in random workout flow.
  - Params:
    - `route` (string, current: `/api/workouts/random`)
    - `status` (number, `0` for network failures)
    - `code` (string, API error code when available)

## Dashboard Setup
In GA4:
1. Create a GA4 property and web data stream for `wod-now.com`.
2. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in production env.
3. Verify page views in Realtime for `/` and `/wod/[id]`.
4. Mark these events as key events (if needed for launch dashboards):
   - `random_workout_requested`
   - `workout_rendered`
   - `workout_by_id_viewed`
   - `api_error`
5. Build reports/explorations for:
   - DAU: Active users (1 day)
   - WAU: Active users (7 days)
   - Sessions
   - Views

## Validation Checklist
- Production loads GA4 script from `www.googletagmanager.com`.
- Page views appear for `/` and `/wod/[id]`.
- Custom events appear with expected parameter keys.
- No event payload contains personal data.
