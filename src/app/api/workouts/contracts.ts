import type { WorkoutRecord } from '../../../lib/db.js';

export const workoutApiSelect = {
  id: true,
  title: true,
  timeCapSeconds: true,
  equipment: true,
  data: true,
  isPublished: true
} as const;

export type WorkoutApiRecord = WorkoutRecord;

export type WorkoutResponse = {
  id: string;
  title: string;
  timeCapSeconds: number;
  equipment: string[];
  data: unknown;
};

const parseEquipment = (equipment: string): string[] | null => {
  try {
    const parsed = JSON.parse(equipment) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseData = (data: string): unknown | null => {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
};

export const toWorkoutResponse = (workout: WorkoutApiRecord): WorkoutResponse | null => {
  const equipment = parseEquipment(workout.equipment);
  const data = parseData(workout.data);

  if (!equipment || data === null) {
    return null;
  }

  return {
    id: workout.id,
    title: workout.title,
    timeCapSeconds: workout.timeCapSeconds,
    equipment,
    data
  };
};
