import { Prisma } from '@prisma/client';

import { jsonError } from '../../../../lib/api-error.js';
import { db } from '../../../../lib/db.js';
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

const matchesEquipment = (workoutEquipment: string[], requiredEquipment: string[]): boolean => {
  if (requiredEquipment.length === 0) {
    return true;
  }

  const workoutSet = new Set(workoutEquipment.map((item) => item.toLowerCase()));
  return requiredEquipment.every((requiredItem) =>
    workoutSet.has(requiredItem.toLowerCase())
  );
};

const pickRandomWorkout = (workouts: WorkoutResponse[]): WorkoutResponse => {
  const index = Math.floor(Math.random() * workouts.length);
  return workouts[index];
};

export async function GET(request: Request): Promise<Response> {
  const query = parseQuery(request);
  if ('error' in query) {
    return jsonError(400, 'BAD_REQUEST', query.error);
  }

  const where: Prisma.WorkoutWhereInput = {
    isPublished: true,
    ...(query.timeCapMax !== undefined
      ? { timeCapSeconds: { lte: query.timeCapMax } }
      : {}),
    ...(query.exclude.length > 0 ? { id: { notIn: query.exclude } } : {})
  };

  const workouts = await db.workout.findMany({
    where,
    select: workoutApiSelect
  });

  const candidates = workouts
    .map(toWorkoutResponse)
    .filter((workout): workout is WorkoutResponse => workout !== null)
    .filter((workout) => matchesEquipment(workout.equipment, query.equipment));

  if (candidates.length === 0) {
    return jsonError(404, 'NOT_FOUND', 'No workout matched the provided filters');
  }

  return Response.json(pickRandomWorkout(candidates), { status: 200 });
}
