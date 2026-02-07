# wod-now

## Local database setup
1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run db:migrate` to apply local Prisma migrations.
4. Verify query plans for V1 filters:
   - `EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "isPublished" = 1`
   - `EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "id" = 'workout_1'`
