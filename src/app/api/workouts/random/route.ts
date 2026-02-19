import {
  applyRateLimitHeaders,
  enforcePublicApiProtections,
  toTimeoutErrorResponse,
  withApiTimeout
} from '../../../../lib/api-abuse-protection.js';
import { jsonError } from '../../../../lib/api-error.js';
import { db } from '../../../../lib/db.js';
import {
  getRandomWorkoutCache,
  setRandomWorkoutCache
} from '../../../../lib/random-workout-cache.js';
import {
  toWorkoutResponse,
  workoutApiSelect,
  type WorkoutResponse
} from '../contracts.js';

type RandomWorkoutQuery = {
  timeCapMax?: number;
  equipment: string[];
  exclude: string[];
};

const parseCsvValues = (searchParams: URLSearchParams, key: string): string[] => {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const parseQuery = (request: Request): RandomWorkoutQuery | { error: string } => {
  const url = new URL(request.url);
  const rawTimeCapMax = url.searchParams.get('timeCapMax');

  if (rawTimeCapMax === null) {
    return {
      equipment: parseCsvValues(url.searchParams, 'equipment'),
      exclude: parseCsvValues(url.searchParams, 'exclude')
    };
  }

  const timeCapMax = Number(rawTimeCapMax);
  if (!Number.isInteger(timeCapMax) || timeCapMax <= 0) {
    return { error: 'timeCapMax must be a positive integer' };
  }

  return {
    timeCapMax,
    equipment: parseCsvValues(url.searchParams, 'equipment'),
    exclude: parseCsvValues(url.searchParams, 'exclude')
  };
};

const normalizeFilterValues = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
};

const toCacheKey = (query: RandomWorkoutQuery): string => {
  return JSON.stringify({
    timeCapMax: query.timeCapMax ?? null,
    equipment: normalizeFilterValues(query.equipment.map((value) => value.toLowerCase())),
    exclude: normalizeFilterValues(query.exclude)
  });
};

export async function GET(request: Request): Promise<Response> {
  const protection = enforcePublicApiProtections(request);
  if ('response' in protection) {
    return protection.response;
  }

  const query = parseQuery(request);
  if ('error' in query) {
    const response = jsonError(400, 'BAD_REQUEST', query.error);
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const cacheKey = toCacheKey(query);
  const cached = getRandomWorkoutCache<WorkoutResponse>(cacheKey);
  if (cached) {
    const response = Response.json(cached, { status: 200 });
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const where = {
    isPublished: true,
    ...(query.timeCapMax !== undefined
      ? { timeCapSeconds: { lte: query.timeCapMax } }
      : {}),
    ...(query.exclude.length > 0 ? { id: { notIn: query.exclude } } : {}),
    ...(query.equipment.length > 0 ? { equipmentAll: query.equipment } : {})
  };

  let workout;
  try {
    workout = await withApiTimeout(
      db.workout.findRandom({
        where,
        select: workoutApiSelect
      }),
      'public'
    );
  } catch {
    return toTimeoutErrorResponse();
  }

  if (!workout) {
    const response = jsonError(404, 'NOT_FOUND', 'No workout matched the provided filters');
    return applyRateLimitHeaders(response, protection.rateLimitHeaders);
  }

  const response = toWorkoutResponse(workout);
  if (response === null) {
    const invalidResponse = jsonError(500, 'INTERNAL_ERROR', 'Stored workout payload is invalid');
    return applyRateLimitHeaders(invalidResponse, protection.rateLimitHeaders);
  }

  setRandomWorkoutCache(cacheKey, response);
  const okResponse = Response.json(response, { status: 200 });
  return applyRateLimitHeaders(okResponse, protection.rateLimitHeaders);
}
