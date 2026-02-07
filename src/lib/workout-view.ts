type WorkoutMovement = {
  name: string;
  reps?: number;
  repScheme?: number[];
  calories?: number;
  distanceMeters?: number;
  load?: string;
  loads?: {
    female?: string;
    male?: string;
  };
  notes?: string;
};

export type WorkoutBlock = {
  name: string;
  duration?: number | 'remaining';
  repScheme?: number[];
  movements: WorkoutMovement[];
  notes?: string;
};

type WorkoutNotes = {
  coach?: string;
  scaling?: string;
};

export type WorkoutData = {
  blocks: WorkoutBlock[];
  notes?: WorkoutNotes;
};

export type WorkoutView = {
  id: string;
  title: string;
  timeCapSeconds: number;
  equipment: string[];
  data: WorkoutData;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isPositiveIntArray = (value: unknown): value is number[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0)
  );
};

const isMovement = (value: unknown): value is WorkoutMovement => {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.trim().length === 0) {
    return false;
  }

  const numberFields = ['reps', 'calories', 'distanceMeters'] as const;
  for (const field of numberFields) {
    const maybeValue = value[field];
    if (maybeValue !== undefined && (typeof maybeValue !== 'number' || !Number.isInteger(maybeValue) || maybeValue <= 0)) {
      return false;
    }
  }

  const stringFields = ['load', 'notes'] as const;
  for (const field of stringFields) {
    const maybeValue = value[field];
    if (maybeValue !== undefined && typeof maybeValue !== 'string') {
      return false;
    }
  }

  if (value.repScheme !== undefined && !isPositiveIntArray(value.repScheme)) {
    return false;
  }

  if (value.loads !== undefined) {
    if (!isRecord(value.loads)) {
      return false;
    }
    const { female, male } = value.loads;
    if (female !== undefined && typeof female !== 'string') {
      return false;
    }
    if (male !== undefined && typeof male !== 'string') {
      return false;
    }
    if (female === undefined && male === undefined) {
      return false;
    }
  }

  return true;
};

const isBlock = (value: unknown): value is WorkoutBlock => {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.trim().length === 0) {
    return false;
  }

  const duration = value.duration;
  if (
    duration !== undefined &&
    duration !== 'remaining' &&
    (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0)
  ) {
    return false;
  }

  if (value.repScheme !== undefined && !isPositiveIntArray(value.repScheme)) {
    return false;
  }

  if (!Array.isArray(value.movements) || value.movements.length === 0) {
    return false;
  }

  return value.movements.every((movement) => isMovement(movement));
};

const parseWorkoutData = (value: unknown): WorkoutData | null => {
  if (!isRecord(value) || !Array.isArray(value.blocks) || value.blocks.length === 0) {
    return null;
  }

  if (!value.blocks.every((block) => isBlock(block))) {
    return null;
  }

  const notes = value.notes;
  if (notes !== undefined) {
    if (!isRecord(notes)) {
      return null;
    }

    if (notes.coach !== undefined && typeof notes.coach !== 'string') {
      return null;
    }
    if (notes.scaling !== undefined && typeof notes.scaling !== 'string') {
      return null;
    }
  }

  return value as WorkoutData;
};

export const parseWorkoutView = (value: unknown): WorkoutView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const timeCapSeconds = value.timeCapSeconds;
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof timeCapSeconds !== 'number' ||
    !Number.isInteger(timeCapSeconds) ||
    timeCapSeconds <= 0
  ) {
    return null;
  }

  if (!Array.isArray(value.equipment) || !value.equipment.every((item) => typeof item === 'string')) {
    return null;
  }

  const data = parseWorkoutData(value.data);
  if (data === null) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    timeCapSeconds,
    equipment: value.equipment,
    data
  };
};
