# V1 Deployment Checklist

## 1. Pre-deploy
- Confirm CI is green for the release commit (`npm test`).
- Confirm `.env` includes:
  - `DATABASE_URL` (pooled/runtime URL from your Vercel Postgres integration)
  - `DIRECT_URL` (direct/non-pooled URL from your Vercel Postgres integration)
  - `ADMIN_API_KEY`
- Confirm seed dataset exists at `/Users/dmaia/development/repos/wod-now/prisma/seed/workouts.json`.

## 2. Database and seed
- Run `npm run db:migrate:deploy`.
- Run `npm run seed`.
- Validate inserted records:
  - `node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();console.log('total='+await p.workout.count()+' published='+await p.workout.count({where:{isPublished:true}}));await p.$disconnect();})();"`
- Expected result: `total>=50` and `published==total`.

## 3. Runtime checks
- Start app: `npm run dev` (or production runtime).
- Random flow check:
  - `curl -i "http://127.0.0.1:3000/api/workouts/random"` returns `200`.
- By-id flow check:
  - Extract an id from random response and request `GET /api/workouts/<id>`; expect `200`.
  - Open `/wod/<id>` in browser; details render without error state.
- Admin ingestion checks:
  - Unauthorized: missing `x-admin-key` returns `401`.
  - Authorized valid payload returns `200` with `id` and `isPublished`.

## 4. Post-deploy monitoring
- Check app logs for `500` responses on:
  - `/api/workouts/random`
  - `/api/workouts/[id]`
  - `/api/admin/workouts`
- If failure is data-related, re-run `npm run seed` and re-test smoke steps.
