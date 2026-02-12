# Phase 2 Managed Postgres Provider Decision (Issue #40)

## Decision
Use **Vercel Postgres** as the single managed Postgres provider for production on Vercel.

## Alternatives considered
- Neon (direct): viable Postgres provider, but adds external integration and secret wiring steps compared to native Vercel integration.
- Supabase Postgres: viable and feature-rich, but introduces additional platform surface area that is not required for current scope.

## Why Vercel Postgres
- Native integration with Vercel projects and environments.
- Managed connection model suitable for serverless deployments.
- Fastest path to a repeatable production setup with low operational overhead.

## Region strategy
- Keep database and application runtime in the same Vercel region.
- For this project, set Vercel runtime region to the same region where the existing Vercel Postgres instance was created.

## Expected cost tier
- Start on the lowest available Vercel Postgres tier that supports production usage for this app stage (typically Starter/Hobby).
- Reassess and upgrade tier when connection count, storage, or throughput approaches plan limits.

## Connection model
- Runtime queries: pooled connection string.
- Migrations/introspection: direct non-pooled connection string.

Prisma mapping:
- `DATABASE_URL` -> pooled URL (from Vercel `POSTGRES_PRISMA_URL`).
- `DIRECT_URL` -> direct URL (from Vercel `POSTGRES_URL_NON_POOLING`).

## Required production environment variables
- `DATABASE_URL`
- `DIRECT_URL`
- `ADMIN_API_KEY`

## Secret handling
- Store values only in Vercel Environment Variables.
- Scope values by environment (`Preview`, `Production`) as needed.
- Never commit real secrets to git.
- Rotate credentials if exposure is suspected.

## Scope boundary for issue #40
This issue selects and documents the provider decision only. Schema provider migration (`sqlite` -> `postgresql`), migrations, and seed execution against managed Postgres are handled by follow-up implementation issues.
