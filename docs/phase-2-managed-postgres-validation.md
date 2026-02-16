# Phase 2 Validation: Managed Postgres API Behavior (Issue #43)

## Goal
Validate API behavior against the Vercel-managed AWS Postgres instance after datasource and seed workflow updates.

## Prerequisites
- `.env` (or deployment environment) includes:
  - Either `DATABASE_URL` + `DIRECT_URL`, or IAM/tutorial vars (`PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `AWS_REGION`).
  - `ADMIN_API_KEY` set to the expected admin secret.
- App runtime has network access to the managed Postgres instance.

## Validation Commands
Run in repo root (`/Users/dmaia/development/repos/wod-now`):

1. Apply schema migrations:
   - URL flow: `npm run db:migrate:deploy`
   - IAM/tutorial flow: `npm run db:migrate:deploy:iam`
2. Seed managed Postgres:
   - URL flow: `npm run seed`
   - IAM/tutorial flow: `npm run db:seed:iam`
3. Verify seeded counts:
   - `node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();console.log('total='+await p.workout.count()+' published='+await p.workout.count({where:{isPublished:true}}));await p.$disconnect();})();"`
4. Start app:
   - `npm run dev`
5. Validate random endpoint:
   - `curl -i "http://127.0.0.1:3000/api/workouts/random"`
6. Validate admin upsert (authorized):
   - `curl -i -X POST "http://127.0.0.1:3000/api/admin/workouts" -H "content-type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" --data '{"id":"phase2-admin-check-001","title":"Phase 2 Admin Check","timeCapSeconds":300,"equipment":["barbell"],"blocks":[{"name":"Main","duration":300,"movements":[{"name":"Thruster","reps":30}]}],"isPublished":true}'`
7. Validate admin auth failure (unauthorized):
   - `curl -i -X POST "http://127.0.0.1:3000/api/admin/workouts" -H "content-type: application/json" --data '{"id":"unauthorized-check","title":"Unauthorized","timeCapSeconds":300,"equipment":["barbell"],"blocks":[{"name":"Main","duration":300,"movements":[{"name":"Thruster","reps":30}]}],"isPublished":true}'`
8. Validate payload failure (bad request):
   - `curl -i -X POST "http://127.0.0.1:3000/api/admin/workouts" -H "content-type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" --data '{"id":"bad-payload-check","title":"Bad Payload","equipment":[],"blocks":[]}'`

## Expected Results
- Seed completes with `failure=0`.
- Seeded count check returns `total>=50` and `published==total`.
- `GET /api/workouts/random` returns `200`.
- Authorized `POST /api/admin/workouts` returns `200` and includes `id` + `isPublished`.
- Unauthorized admin request returns `401` with `UNAUTHORIZED`.
- Invalid payload admin request returns `400` with `BAD_REQUEST` and validation details.

## Evidence Template (fill in during execution)
- Migration command/result:
  - `npm run db:migrate:deploy`
  - Output summary:
- Seed command/result:
  - `npm run seed`
  - Output summary:
- Data verification command/result:
  - `node -e "..."` count output:
- Random endpoint result:
  - Status/code summary:
- Admin authorized result:
  - Status/code summary:
- Admin unauthorized result:
  - Status/code summary:
- Admin invalid payload result:
  - Status/code summary:
