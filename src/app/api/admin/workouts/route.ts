import { z } from 'zod';

import {
  applyRateLimitHeaders,
  clearAdminAuthFailureState,
  enforceAdminRoutePreAuth,
  registerAdminAuthFailure,
  toTimeoutErrorResponse,
  withApiTimeout
} from '../../../../lib/api-abuse-protection.js';
import { jsonError, type ApiErrorDetail } from '../../../../lib/api-error.js';
import { db } from '../../../../lib/db.js';
import { clearRandomWorkoutCache } from '../../../../lib/random-workout-cache.js';
import { safeParseWorkout } from '../../../../lib/workout-schema.js';

type AdminWorkoutResponse = {
  id: string;
  isPublished: boolean;
};

const badRequest = (message: string, details?: ApiErrorDetail[]): Response => {
  return jsonError(400, 'BAD_REQUEST', message, details);
};

const toPath = (path: ReadonlyArray<PropertyKey>): string => {
  if (path.length === 0) {
    return '$';
  }

  return path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      if (typeof segment === 'symbol') {
        return segment.toString();
      }
      return segment;
    })
    .join('.');
};

const toValidationDetails = (issues: z.ZodIssue[]): ApiErrorDetail[] => {
  return issues.map((issue) => ({
    path: toPath(issue.path),
    message: issue.message
  }));
};

const parseAdminAuth = (request: Request): boolean => {
  const configuredKey = process.env.ADMIN_API_KEY;
  const requestKey = request.headers.get('x-admin-key');

  if (!configuredKey || !requestKey) {
    return false;
  }

  return requestKey === configuredKey;
};

export async function POST(request: Request): Promise<Response> {
  const protection = enforceAdminRoutePreAuth(request);
  if ('response' in protection) {
    return protection.response;
  }

  if (!parseAdminAuth(request)) {
    const denied = registerAdminAuthFailure(protection.key).response;
    return applyRateLimitHeaders(denied, protection.rateLimitHeaders);
  }
  clearAdminAuthFailureState(protection.key);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const response = badRequest('Request body must be valid JSON');
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const parsedWorkout = safeParseWorkout(payload);
  if (!parsedWorkout.success) {
    const response = badRequest(
      'Workout payload validation failed',
      toValidationDetails(parsedWorkout.error.issues)
    );
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const workout = parsedWorkout.data;
  let persisted;
  try {
    persisted = await withApiTimeout(
      db.workout.upsert({
        where: { id: workout.id },
        create: {
          id: workout.id,
          title: workout.title,
          timeCapSeconds: workout.timeCapSeconds ?? 0,
          equipment: JSON.stringify(workout.equipment),
          data: JSON.stringify({
            blocks: workout.blocks,
            ...(workout.notes ? { notes: workout.notes } : {})
          }),
          isPublished: workout.isPublished
        },
        update: {
          title: workout.title,
          timeCapSeconds: workout.timeCapSeconds ?? 0,
          equipment: JSON.stringify(workout.equipment),
          data: JSON.stringify({
            blocks: workout.blocks,
            ...(workout.notes ? { notes: workout.notes } : {})
          }),
          isPublished: workout.isPublished
        },
        select: {
          id: true,
          isPublished: true
        }
      }),
      'admin'
    );
  } catch {
    return toTimeoutErrorResponse();
  }

  const response: AdminWorkoutResponse = {
    id: persisted.id,
    isPublished: persisted.isPublished
  };

  clearRandomWorkoutCache();
  const okResponse = Response.json(response, { status: 200 });
  return applyRateLimitHeaders(okResponse, protection.rateLimitHeaders);
}
