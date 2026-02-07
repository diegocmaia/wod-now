import { db } from '../../../../lib/db.js';

import {
  toWorkoutResponse,
  workoutApiSelect
} from '../contracts.js';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  const workout = await db.workout.findFirst({
    where: {
      id: context.params.id,
      isPublished: true
    },
    select: workoutApiSelect
  });

  if (!workout) {
    return new Response(null, { status: 404 });
  }

  const response = toWorkoutResponse(workout);
  if (response === null) {
    return Response.json({ error: 'Invalid workout payload' }, { status: 500 });
  }

  return Response.json(response, { status: 200 });
}
