# Product Analytics Baseline

This project uses Plausible Analytics for privacy-conscious product analytics.

## Why Plausible
- No cookies and no cross-site user profiling by default.
- Built-in unique visitors, visits, session metrics, and page views.
- Custom events for product behavior without collecting PII.
- Lightweight client script with minimal app overhead.

## Configuration
Environment variables:
- `NEXT_PUBLIC_ANALYTICS_PROVIDER`:
  - Default: `plausible`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`:
  - Production domain tracked by Plausible.
  - Default: `wod-now.com`
- `NEXT_PUBLIC_ANALYTICS_ENABLED`:
  - Optional explicit toggle.
  - `true`/`false`, `1`/`0`, `on`/`off`.
  - If not set: enabled in production, disabled locally.

## Event Taxonomy
All events avoid PII and avoid user identifiers.

- `random_workout_requested`
  - Trigger: user clicks "Get random workout".
  - Props:
    - `has_time_cap_filter` (boolean)
    - `equipment_count` (number)
    - `exclude_count` (number)
- `workout_rendered`
  - Trigger: random workout successfully rendered.
  - Props:
    - `source` (`random`)
    - `equipment_count` (number)
    - `time_cap_seconds` (number)
- `workout_by_id_viewed`
  - Trigger: `/wod/[id]` page rendered.
  - Props:
    - `found` (boolean)
- `api_error`
  - Trigger: client-observed API failures in random workout flow.
  - Props:
    - `route` (string, current: `/api/workouts/random`)
    - `status` (number, `0` for network failures)
    - `code` (string, API error code when available)

## Dashboard Setup
In Plausible:
1. Add site `wod-now.com` (or your production domain).
2. Verify script ingestion from production traffic.
3. Use default metrics:
   - Unique Visitors (DAU view with Last 1 day)
   - Unique Visitors (WAU view with Last 7 days)
   - Visits
   - Pageviews
4. Add goal/event filters for:
   - `random_workout_requested`
   - `workout_rendered`
   - `workout_by_id_viewed`
   - `api_error`
5. Save shared dashboard views:
   - "Launch Health - Daily"
   - "Launch Health - Weekly"

## Validation Checklist
- Production has Plausible script loaded.
- Page views appear for `/` and `/wod/[id]`.
- Custom events appear with expected property keys.
- No event payload contains personal data.
