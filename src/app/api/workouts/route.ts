import { db } from '../../../lib/db.js';

type WorkoutsScaffoldResponse = {
  count: number;
};

export async function GET(): Promise<Response> {
  const count = await db.workout.count({});
  const body: WorkoutsScaffoldResponse = { count };

  return Response.json(body, { status: 200 });
}
