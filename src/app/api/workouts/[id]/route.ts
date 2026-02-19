import {
  applyRateLimitHeaders,
  enforcePublicApiProtections,
  toTimeoutErrorResponse,
  withApiTimeout
} from '../../../../lib/api-abuse-protection.js';
import { jsonError } from '../../../../lib/api-error.js';
import { db } from '../../../../lib/db.js';

import {
  toWorkoutResponse,
  workoutApiSelect
} from '../contracts.js';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  const protection = enforcePublicApiProtections(request);
  if ('response' in protection) {
    return protection.response;
  }

  const { id } = await params;
  let workout;
  try {
    workout = await withApiTimeout(
      db.workout.findFirst({
        where: {
          id,
          isPublished: true
        },
        select: workoutApiSelect
      }),
      'public'
    );
  } catch {
    return toTimeoutErrorResponse();
  }

  if (!workout) {
    const response = jsonError(404, 'NOT_FOUND', 'Workout not found');
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const response = toWorkoutResponse(workout);
  if (response === null) {
    const invalidResponse = jsonError(500, 'INTERNAL_ERROR', 'Stored workout payload is invalid');
    return applyRateLimitHeaders(invalidResponse, protection.rateLimitHeaders);
  }

  const okResponse = Response.json(response, { status: 200 });
  return applyRateLimitHeaders(okResponse, protection.rateLimitHeaders);
}
