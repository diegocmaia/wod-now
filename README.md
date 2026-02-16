# wod-now

## Environment Variables
Create a `.env` file in the repo root.

- `DATABASE_URL`:
  - Required pooled/runtime Postgres connection string.
  - On Vercel-managed AWS Postgres, map from the pooled URL env provided by Vercel (commonly `POSTGRES_PRISMA_URL`).
  - Used by Prisma for API reads/writes and seeding.
- `DIRECT_URL`:
  - Required direct/non-pooled Postgres connection string.
  - On Vercel-managed AWS Postgres, map from the direct/non-pooled URL env provided by Vercel (commonly `POSTGRES_URL_NON_POOLING`).
  - Used for migrations (`prisma migrate deploy`).
- `ADMIN_API_KEY`:
  - Required by `POST /api/admin/workouts` via `x-admin-key` header.
  - Example: `ADMIN_API_KEY="replace-with-long-random-secret"`

Reference example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require&connect_timeout=15"
ADMIN_API_KEY="replace-with-long-random-secret"
```

For Vercel-managed AWS Postgres setup:
- Set `DATABASE_URL` from the pooled URL variable exposed by your Vercel Postgres integration.
- Set `DIRECT_URL` from the direct/non-pooled URL variable exposed by your Vercel Postgres integration.
- Store production secrets in Vercel Environment Variables only.

## Local Database Setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Set `.env` values:
   - `DATABASE_URL` -> pooled/runtime URL from Vercel Postgres integration
   - `DIRECT_URL` -> non-pooled/direct URL from Vercel Postgres integration
   - `ADMIN_API_KEY` -> random secret used by admin ingestion route
4. Run `npm run db:migrate:deploy`.
5. Run `npm run seed` to validate and upsert curated workouts.
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

## API Contracts
### Error response contract (all endpoints)
- Non-`200` responses return JSON:
  - `error.code: string`
  - `error.message: string`
  - `error.details?: { path: string; message: string }[]`

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
  - `400` when request body JSON is invalid or workout validation fails
