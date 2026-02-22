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

const equipmentAliases: Record<string, string> = {
  dumbbells: 'dumbbell',
  'dumb bell': 'dumbbell',
  'dumb bells': 'dumbbell'
};

const parsePositiveInt = (rawValue: string | undefined, fallback: number): number => {
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
};

const randomWorkoutEdgeCacheTtlSeconds = parsePositiveInt(
  process.env.RANDOM_WOD_EDGE_CACHE_TTL_SECONDS,
  30
);
const randomWorkoutEdgeCacheSwrSeconds = parsePositiveInt(
  process.env.RANDOM_WOD_EDGE_CACHE_SWR_SECONDS,
  120
);

const parseCsvValues = (searchParams: URLSearchParams, key: string): string[] => {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const normalizeEquipmentFilterValue = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ');

  return equipmentAliases[normalized] ?? normalized;
};

const parseQuery = (request: Request): RandomWorkoutQuery | { error: string } => {
  const url = new URL(request.url);
  const rawTimeCapMax = url.searchParams.get('timeCapMax');

  if (rawTimeCapMax === null) {
    return {
      equipment: parseCsvValues(url.searchParams, 'equipment').map(normalizeEquipmentFilterValue),
      exclude: parseCsvValues(url.searchParams, 'exclude')
    };
  }

  const timeCapMax = Number(rawTimeCapMax);
  if (!Number.isInteger(timeCapMax) || timeCapMax <= 0) {
    return { error: 'timeCapMax must be a positive integer' };
  }

  return {
    timeCapMax,
    equipment: parseCsvValues(url.searchParams, 'equipment').map(normalizeEquipmentFilterValue),
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

const shouldUseMemoryCache = (query: RandomWorkoutQuery): boolean => query.exclude.length === 0;

const withCacheHeaders = (response: Response, query: RandomWorkoutQuery): Response => {
  const headers = new Headers(response.headers);
  const cacheControl =
    query.exclude.length > 0
      ? 'private, no-store'
      : `public, s-maxage=${randomWorkoutEdgeCacheTtlSeconds}, stale-while-revalidate=${randomWorkoutEdgeCacheSwrSeconds}`;
  headers.set('Cache-Control', cacheControl);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
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

  const useMemoryCache = shouldUseMemoryCache(query);
  const cacheKey = toCacheKey(query);
  if (useMemoryCache) {
    const cached = getRandomWorkoutCache<WorkoutResponse>(cacheKey);
    if (cached) {
      const response = withCacheHeaders(Response.json(cached, { status: 200 }), query);
      return applyRateLimitHeaders(response, protection.rateLimitHeaders);
    }
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

  if (useMemoryCache) {
    setRandomWorkoutCache(cacheKey, response);
  }

  const okResponse = withCacheHeaders(Response.json(response, { status: 200 }), query);
  return applyRateLimitHeaders(okResponse, protection.rateLimitHeaders);
}
