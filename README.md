# wod-now

## Environment Variables
Create a `.env` file in the repo root.

- `DATABASE_URL`:
  - Required runtime database connection string when `WORKOUTS_DATA_SOURCE="postgres"` (default).
- `DIRECT_URL`:
  - Optional direct database connection string for Prisma migration workflows (`prisma migrate deploy`).
- `WORKOUTS_DATA_SOURCE`:
  - Optional workout storage backend selector.
  - Supported values: `postgres` (default), `parquet`.
- `WORKOUTS_PARQUET_PATH`:
  - Optional path to workouts Parquet file when `WORKOUTS_DATA_SOURCE="parquet"`.
  - Default: `data/workouts.parquet`.
- `NEXT_PUBLIC_SITE_URL`:
  - Optional but recommended canonical site origin used for metadata, `robots.txt`, and `sitemap.xml`.
  - Example: `NEXT_PUBLIC_SITE_URL="https://wod-now.com"`
- `NEXT_PUBLIC_ANALYTICS_ENABLED`:
  - Optional analytics override (`true`/`false`).
  - By default analytics is enabled in production and disabled locally.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`:
  - GA4 measurement ID used by frontend analytics (example: `G-XXXXXXXXXX`).
  - Required for analytics event/pageview collection.
- `RANDOM_WOD_CACHE_TTL_SECONDS`:
  - Optional cache TTL for `GET /api/workouts/random` responses (default `30`).
- `RANDOM_WOD_CACHE_MAX_KEYS`:
  - Optional max in-memory cache keys for random endpoint filter combinations (default `200`).
- `RANDOM_WOD_EDGE_CACHE_TTL_SECONDS`:
  - Optional CDN/shared-cache TTL for cacheable random endpoint responses (default `30`).
- `RANDOM_WOD_EDGE_CACHE_SWR_SECONDS`:
  - Optional stale-while-revalidate window for cacheable random endpoint responses (default `120`).
- `ADMIN_API_KEY`:
  - Required by `POST /api/admin/workouts` via `x-admin-key` header.
  - Example: `ADMIN_API_KEY="replace-with-long-random-secret"`
- `API_PUBLIC_RATE_LIMIT_PER_MINUTE`:
  - Optional public API requests per IP+route per minute (default `60`).
- `API_ADMIN_RATE_LIMIT_PER_MINUTE`:
  - Optional admin API requests per IP per minute (default `12`).
- `API_ADMIN_AUTH_FAILURE_THRESHOLD`:
  - Optional failed admin auth attempts before lockout (default `5`).
- `API_ADMIN_LOCKOUT_BASE_SECONDS`:
  - Optional base lockout duration in seconds (default `30`), with exponential backoff.
- `API_ADMIN_LOCKOUT_MAX_SECONDS`:
  - Optional max lockout duration in seconds (default `900`).
- `API_ADMIN_REQUEST_MAX_BYTES`:
  - Optional max request body size for admin route (default `65536`).
- `API_PUBLIC_REQUEST_TIMEOUT_MS`:
  - Optional timeout for public route DB operations (default `1500`).
- `API_ADMIN_REQUEST_TIMEOUT_MS`:
  - Optional timeout for admin route DB operations (default `2500`).
- `API_MAX_URL_LENGTH`:
  - Optional max request URL length before `414` (default `2048`).

Reference example:

```env
DATABASE_URL=""
DIRECT_URL=""
WORKOUTS_DATA_SOURCE="postgres"
WORKOUTS_PARQUET_PATH="data/workouts.parquet"
NEXT_PUBLIC_SITE_URL=""
NEXT_PUBLIC_ANALYTICS_ENABLED=""
NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ADMIN_API_KEY="replace-with-long-random-secret"
```

## Temporary Parquet Fallback
Use this only while Postgres connectivity is unavailable.

1. Export curated workouts dataset to Parquet:
   - `npm run export:workouts:parquet`
2. Configure `.env`:
   - `WORKOUTS_DATA_SOURCE="parquet"`
   - `WORKOUTS_PARQUET_PATH="data/workouts.parquet"` (or your custom path)
3. Start app:
   - `npm run dev`

Notes:
- Parquet mode is temporary and optimized for reads (`GET /api/workouts/*`).
- Admin upserts are kept in process memory and are not persisted back to the Parquet file.
- Switch back to Postgres by setting `WORKOUTS_DATA_SOURCE="postgres"` and restoring `DATABASE_URL`.

## Local Database Setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Set `.env` values:
   - Set `DATABASE_URL` (and optionally `DIRECT_URL` for migrations)
   - `ADMIN_API_KEY` -> random secret used by admin ingestion route
4. Run migrations:
   - `npm run db:migrate:deploy`
5. Run seed:
   - `npm run seed`
6. Verify inserted records:
   - `node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();console.log('total='+await p.workout.count()+' published='+await p.workout.count({where:{isPublished:true}}));await p.$disconnect();})();"`

## V1 Smoke Tests
Run these after deployment (or locally with `npm run dev`).

1. Random workout flow:
   - Open `/` and click `Get random workout`.
   - Confirm a workout card is rendered with `id`, `title`, `timeCapSeconds`, `equipment`, and `data`.
   - API spot check: `curl -sS "http://127.0.0.1:3000/api/workouts/random"` returns `200`.
2. By-id page flow:
   - From a random response, copy `id` (example: `v1-fran`).
   - Open `/wod/<id>` and confirm workout details render.
   - API spot check: `curl -sS "http://127.0.0.1:3000/api/workouts/<id>"` returns `200`.
3. Admin ingestion flow:
   - Send an authenticated upsert request:
     - `curl -i -X POST "http://127.0.0.1:3000/api/admin/workouts" -H "content-type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" --data '{"id":"smoke-admin-001","title":"Smoke Admin","timeCapSeconds":300,"equipment":["barbell"],"blocks":[{"name":"Main","duration":300,"movements":[{"name":"Thruster","reps":30}]}],"isPublished":true}'`
   - Confirm unauthorized requests without `x-admin-key` return `401`.
   - Confirm valid payloads return `200` with `id` and `isPublished`.

## Deployment Checklist
Use the V1 release runbook in `/Users/dmaia/development/repos/wod-now/docs/v1-deploy-checklist.md`.
Provider selection decision for Phase 2 is documented in `/Users/dmaia/development/repos/wod-now/docs/phase-2-postgres-provider-decision.md`.
Phase 2 validation evidence checklist is in `/Users/dmaia/development/repos/wod-now/docs/phase-2-managed-postgres-validation.md`.
Security header policy and CSP exceptions are documented in `/Users/dmaia/development/repos/wod-now/docs/security-headers.md`.
Analytics provider setup and event taxonomy are documented in `/Users/dmaia/development/repos/wod-now/docs/analytics.md`.
Random workout query scaling and benchmark guidance are documented in `/Users/dmaia/development/repos/wod-now/docs/random-workout-query-scaling.md`.

## API Contracts
### Error response contract (all endpoints)
- Non-`200` responses return JSON:
  - `error.code: string`
  - `error.message: string`
  - `error.details?: { path: string; message: string }[]`
- Abuse protection responses:
  - `429` for rate limits/lockouts (`Retry-After` header included)
  - `403` for blocked suspicious bot/scanner patterns
  - `414` for oversized URL requests
  - `413` for oversized admin request bodies
  - `503` when request timeout thresholds are exceeded

### `GET /api/workouts/random`
- Query params:
  - `timeCapMax` (optional positive integer, seconds)
  - `equipment` (optional CSV list)
  - `exclude` (optional CSV list of workout ids)
- Responses:
  - `200` with one published workout:
    - `id: string`
    - `title: string`
    - `timeCapSeconds: number`
    - `equipment: string[]`
    - `data: unknown`
  - `404` when no workout matches filters
  - `400` when `timeCapMax` is invalid

### `GET /api/workouts/[id]`
- Path param:
  - `id` workout id
- Responses:
  - `200` with published workout payload:
    - `id: string`
    - `title: string`
    - `timeCapSeconds: number`
    - `equipment: string[]`
    - `data: unknown`
  - `404` for missing or unpublished id

### `POST /api/admin/workouts`
- Headers:
  - `x-admin-key` required and must match `ADMIN_API_KEY`
- Body:
  - workout payload validated by `/Users/dmaia/development/repos/wod-now/src/lib/workout-schema.ts`
- Responses:
  - `200` with:
    - `id: string`
    - `isPublished: boolean`
  - `401` when `x-admin-key` is missing or invalid
  - `429` when admin lockout/rate limit is triggered (includes `Retry-After`)
  - `400` when request body JSON is invalid or workout validation fails
