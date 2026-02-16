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
  const query = parseQuery(request);
  if ('error' in query) {
    return jsonError(400, 'BAD_REQUEST', query.error);
  }

  const cacheKey = toCacheKey(query);
  const cached = getRandomWorkoutCache<WorkoutResponse>(cacheKey);
  if (cached) {
    return Response.json(cached, { status: 200 });
  }

  const where = {
    isPublished: true,
    ...(query.timeCapMax !== undefined
      ? { timeCapSeconds: { lte: query.timeCapMax } }
      : {}),
    ...(query.exclude.length > 0 ? { id: { notIn: query.exclude } } : {}),
    ...(query.equipment.length > 0 ? { equipmentAll: query.equipment } : {})
  };

  const workout = await db.workout.findRandom({
    where,
    select: workoutApiSelect
  });

  if (!workout) {
    return jsonError(404, 'NOT_FOUND', 'No workout matched the provided filters');
  }

  const response = toWorkoutResponse(workout);
  if (response === null) {
    return jsonError(500, 'INTERNAL_ERROR', 'Stored workout payload is invalid');
  }

  setRandomWorkoutCache(cacheKey, response);
  return Response.json(response, { status: 200 });
}
