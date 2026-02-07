import { z } from 'zod';

import { db } from '../../../../lib/db.js';
import { safeParseWorkout } from '../../../../lib/workout-schema.js';

type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Array<{
      path: string;
      message: string;
    }>;
  };
};

type AdminWorkoutResponse = {
  id: string;
  isPublished: boolean;
};

const unauthorized = (): Response => {
  const body: ApiError = {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid admin API key'
    }
  };

  return Response.json(body, { status: 401 });
};

const badRequest = (message: string, details?: ApiError['error']['details']): Response => {
  const body: ApiError = {
    error: {
      code: 'BAD_REQUEST',
      message,
      ...(details && details.length > 0 ? { details } : {})
    }
  };

  return Response.json(body, { status: 400 });
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

const toValidationDetails = (issues: z.ZodIssue[]): ApiError['error']['details'] => {
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
  if (!parseAdminAuth(request)) {
    return unauthorized();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsedWorkout = safeParseWorkout(payload);
  if (!parsedWorkout.success) {
    return badRequest('Workout payload validation failed', toValidationDetails(parsedWorkout.error.issues));
  }

  const workout = parsedWorkout.data;
  const persisted = await db.workout.upsert({
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
  });

  const response: AdminWorkoutResponse = {
    id: persisted.id,
    isPublished: persisted.isPublished
  };

  return Response.json(response, { status: 200 });
}
