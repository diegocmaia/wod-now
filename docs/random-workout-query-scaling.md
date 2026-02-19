# Random Workout Query Scaling

## Summary
Issue #54 replaces `ORDER BY random()` with a two-step strategy for `GET /api/workouts/random`:

1. `COUNT(*)` for the filtered candidate set.
2. Deterministic lookup with `ORDER BY "id" OFFSET <randomOffset> LIMIT 1`.

This avoids a full-table random sort per request and scales better for high-row-count tables.

## Indexing
Added migration: `prisma/migrations/20260219120000_optimize_random_workout_lookup/migration.sql`

- `idx_workouts_is_published_id` on `("isPublished", "id")`
- `idx_workouts_is_published_timecap_id` on `("isPublished", "timeCapSeconds", "id")`

These support common filters plus ordered ID lookup in the optimized path.

## Cache Strategy
Route: `GET /api/workouts/random`

- In-memory cache (`RANDOM_WOD_CACHE_*`) is used only when `exclude` is empty.
  - Rationale: `exclude` values create high-cardinality keys and poor reuse.
- Response cache header policy:
  - No `exclude`: `public, s-maxage=30, stale-while-revalidate=120` (configurable)
  - With `exclude`: `private, no-store`

Config knobs:

- `RANDOM_WOD_CACHE_TTL_SECONDS` (default `30`)
- `RANDOM_WOD_CACHE_MAX_KEYS` (default `200`)
- `RANDOM_WOD_EDGE_CACHE_TTL_SECONDS` (default `30`)
- `RANDOM_WOD_EDGE_CACHE_SWR_SECONDS` (default `120`)

## Benchmark + Query Plan Validation
Use the benchmark script to evaluate behavior on large datasets and inspect query plans.

Command:

```bash
BENCHMARK_ROWS=200000 BENCHMARK_ITERATIONS=250 BENCHMARK_TIMECAP_MAX=900 npm run bench:random-workout-query
```

Requirements:

- `DATABASE_URL` pointing to a Postgres instance.
- Run against a non-production database.

Output includes:

- p50/p95/p99 latency for both strategies.
- `EXPLAIN (ANALYZE, BUFFERS)` for:
  - legacy `ORDER BY random()`
  - optimized `COUNT(*)`
  - optimized ordered select with offset

## p95 Target Guidance
Suggested initial target for `GET /api/workouts/random` under benchmark load:

- p95 < 80ms database time for default filters.

If p95 regresses above target:

1. Confirm index usage from `EXPLAIN` output.
2. Re-run with realistic `timeCapMax` and equipment filters.
3. Increase cache effectiveness for common filter combinations.
4. Consider precomputed candidate pools for very high volumes.
