import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { safeParseWorkout, type Workout } from '../src/lib/workout-schema.js';

type Logger = Pick<Console, 'info' | 'error'>;

type PersistedWorkout = {
  id: string;
  title: string;
  timeCapSeconds: number;
  equipment: string;
  data: string;
  isPublished: true;
};

const defaultDatasetPath = path.resolve(process.cwd(), 'prisma/seed/workouts.json');

const formatIssuePath = (pathSegments: ReadonlyArray<PropertyKey>): string => {
  if (pathSegments.length === 0) {
    return '$';
  }

  return pathSegments
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
    .join('.');
};

export const toPersistedWorkout = (workout: Workout): PersistedWorkout => {
  if (workout.timeCapSeconds === undefined) {
    throw new Error(`Workout \"${workout.id}\" is missing timeCapSeconds`);
  }

  return {
    id: workout.id,
    title: workout.title,
    timeCapSeconds: workout.timeCapSeconds,
    equipment: JSON.stringify(workout.equipment),
    data: JSON.stringify({
      blocks: workout.blocks,
      ...(workout.notes ? { notes: workout.notes } : {})
    }),
    isPublished: true
  };
};

export const validateDataset = (payload: unknown): Workout[] => {
  if (!Array.isArray(payload)) {
    throw new Error('Seed payload must be an array of workouts');
  }

  const ids = new Set<string>();
  const workouts: Workout[] = [];
  const errors: string[] = [];

  payload.forEach((item, index) => {
    const parsed = safeParseWorkout(item);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(
          `index=${index} path=${formatIssuePath(issue.path)} message=${issue.message}`
        );
      }
      return;
    }

    if (parsed.data.timeCapSeconds === undefined) {
      errors.push(`index=${index} path=timeCapSeconds message=Must be provided`);
      return;
    }

    if (ids.has(parsed.data.id)) {
      errors.push(`index=${index} path=id message=Duplicate workout id \"${parsed.data.id}\"`);
      return;
    }

    ids.add(parsed.data.id);
    workouts.push(parsed.data);
  });

  if (errors.length > 0) {
    throw new Error(`Dataset validation failed with ${errors.length} issue(s):\n${errors.join('\n')}`);
  }

  return workouts;
};

export const loadDataset = async (datasetPath = defaultDatasetPath): Promise<Workout[]> => {
  const raw = await readFile(datasetPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  return validateDataset(parsed);
};

export const seedWorkouts = async (
  prisma: PrismaClient,
  workouts: Workout[],
  logger: Logger = console
): Promise<void> => {
  let successCount = 0;
  let failureCount = 0;

  logger.info(`[seed] starting upsert for ${workouts.length} workout(s)`);

  for (const workout of workouts) {
    try {
      const persistable = toPersistedWorkout(workout);
      await prisma.workout.upsert({
        where: { id: persistable.id },
        create: persistable,
        update: {
          title: persistable.title,
          timeCapSeconds: persistable.timeCapSeconds,
          equipment: persistable.equipment,
          data: persistable.data,
          isPublished: true
        }
      });

      successCount += 1;
      logger.info(`[seed] upserted workout id=${persistable.id} published=true`);
    } catch (error) {
      failureCount += 1;
      logger.error(
        `[seed] failed workout id=${workout.id} error=${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  logger.info(`[seed] complete success=${successCount} failure=${failureCount}`);

  if (failureCount > 0) {
    throw new Error(`Seed finished with ${failureCount} failure(s)`);
  }
};

export const runSeed = async (logger: Logger = console): Promise<void> => {
  const prisma = new PrismaClient();

  try {
    const databases = (await prisma.$queryRawUnsafe(
      'PRAGMA database_list;'
    )) as Array<{ file?: string | null }>;
    const sqliteFile = databases.find((db) => db.file && db.file.length > 0)?.file ?? 'unknown';
    logger.info(`[seed] connected database file=${sqliteFile}`);

    const workoutTable = (await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Workout';"
    )) as Array<{ name: string }>;
    if (workoutTable.length === 0) {
      throw new Error('Workout table not found. Run `npm run db:push` before seeding.');
    }

    logger.info(`[seed] loading dataset from ${defaultDatasetPath}`);
    const workouts = await loadDataset(defaultDatasetPath);
    logger.info(`[seed] validated ${workouts.length} workout(s)`);
    await seedWorkouts(prisma, workouts, logger);
  } finally {
    await prisma.$disconnect();
  }
};

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).endsWith(path.join('prisma', 'seed.ts'));

if (isDirectRun) {
  runSeed().catch((error) => {
    console.error(
      `[seed] fatal error=${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
