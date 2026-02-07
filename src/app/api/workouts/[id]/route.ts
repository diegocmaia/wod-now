import { jsonError } from '../../../../lib/api-error.js';
import { db } from '../../../../lib/db.js';

import {
  toWorkoutResponse,
  workoutApiSelect
} from '../contracts.js';

type RouteContext = {
  params:
    | {
        id: string;
      }
    | Promise<{
    id: string;
      }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<Response> {
  const params = await Promise.resolve(context.params);
  const workout = await db.workout.findFirst({
    where: {
      id: params.id,
      isPublished: true
    },
    select: workoutApiSelect
  });

  if (!workout) {
    return jsonError(404, 'NOT_FOUND', 'Workout not found');
  }

  const response = toWorkoutResponse(workout);
  if (response === null) {
    return jsonError(500, 'INTERNAL_ERROR', 'Stored workout payload is invalid');
  }

  return Response.json(response, { status: 200 });
}
