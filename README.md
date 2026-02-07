# wod-now

## Local database setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate` to apply local Prisma migrations.

## API contracts
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
