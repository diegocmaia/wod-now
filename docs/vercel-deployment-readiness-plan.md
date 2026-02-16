# Vercel Deployment Readiness Plan

## Goal
Prepare `wod-now` for a successful and repeatable production deployment on Vercel.

## Current blockers
1. Production build fails due to an invalid Next.js route handler signature:
   - `src/app/api/workouts/[id]/route.ts`
2. Verify runtime env mapping for Vercel-managed AWS Postgres:
   - URL flow: `DATABASE_URL` + `DIRECT_URL`
   - IAM tutorial flow: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGSSLMODE`, `AWS_REGION`
3. `ADMIN_API_KEY` is required by `POST /api/admin/workouts` and must be configured in Vercel environments.

## Phase 1: Build and typecheck fix (required before deploy)
1. Update route signature in `src/app/api/workouts/[id]/route.ts` to Next 15-compatible form.
2. Keep route behavior unchanged (404 for missing/unpublished, 500 for invalid stored payload).
3. Validate:
   - `npm run build` passes
   - `npm run typecheck` passes
   - `npm test` passes

## Phase 2: Production database strategy (required for real production usage)
1. Provider decision (selected): **Vercel Postgres**.
2. Decision rationale:
   - Native Vercel integration for environment variable injection and secret handling.
   - Managed Postgres with connection pooling support suitable for serverless runtime.
   - Lowest operational overhead for this project stage versus self-managed alternatives.
3. Region strategy:
   - Primary database region must match app runtime region to minimize latency.
   - Default runtime region for this app should be set to the same region as the Vercel Postgres instance.
4. Expected cost tier:
   - Start on the lowest Vercel Postgres tier that supports current production load expectations.
   - Re-evaluate and upgrade tier when storage, throughput, or connection limits are approached.
5. Connection strategy:
   - `DATABASE_URL` should use pooled connection string (`POSTGRES_PRISMA_URL` in Vercel-managed variables).
   - `DIRECT_URL` should use non-pooled/direct connection string (`POSTGRES_URL_NON_POOLING`) for migration operations.
6. Required production env vars:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `ADMIN_API_KEY`
7. Secret handling:
   - Store secrets only in Vercel Environment Variables (Preview/Production scoped as needed).
   - Do not commit live values to `.env`, `.env.example`, or repository docs.
   - Rotate `ADMIN_API_KEY` and database credentials on suspected exposure.
8. Implementation checkpoints:
   - Prisma datasource provider is `postgresql` in `prisma/schema.prisma`.
   - Postgres-compatible migrations are committed and applied via `prisma migrate deploy`.
   - Seed preflight validates schema availability for managed Postgres usage.
9. Validate:
   - Seed completes against managed DB
   - `/api/workouts/random` returns 200 with seeded data
   - `/api/admin/workouts` can upsert with valid admin key

## Phase 3: Vercel project configuration
1. Create Vercel project and connect Git repository.
2. Configure Environment Variables in Vercel:
   - `DATABASE_URL` (managed DB connection string)
   - `ADMIN_API_KEY` (long random secret)
3. Confirm build settings:
   - Framework preset: Next.js
   - Install command: `npm install`
   - Build command: `npm run build`
4. Optional: add preview/prod environment value separation for `ADMIN_API_KEY`.

## Phase 4: Deploy-time database operations
1. Decide migration execution strategy:
   - CI/CD pre-deploy migration job, or
   - Vercel build/deploy hook running `prisma migrate deploy`.
2. Ensure Prisma client generation is part of build lifecycle if needed.
3. Add runbook notes to avoid schema drift.

## Phase 5: Post-deploy verification
1. Smoke test endpoints in deployed URL:
   - `GET /api/workouts/random`
   - `GET /api/workouts/<id>`
   - `POST /api/admin/workouts` with/without `x-admin-key`
2. Verify app page flows:
   - `/` random workout rendering
   - `/wod/<id>` detail rendering
3. Confirm no `500` errors in Vercel logs for API routes.

## Execution order
1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

## Definition of done
1. `npm run build`, `npm run typecheck`, and `npm test` all pass on main branch.
2. Vercel deployment succeeds without manual fixes.
3. Managed production database is connected and durable.
4. All API smoke tests pass on deployed environment.
5. Deployment and rollback steps are documented in project docs.
