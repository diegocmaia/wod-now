# wod-now

## Local database setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate` to apply local Prisma migrations.
4. Verify query plans for V1 filters:
   - `EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "isPublished" = 1`
   - `EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "id" = 'workout_1'`

## API contracts
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
