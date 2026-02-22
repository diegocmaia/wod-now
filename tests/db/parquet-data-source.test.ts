import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type GlobalDbState = typeof globalThis & {
  db: unknown;
  dbPool: unknown;
  dbDataSource: unknown;
  parquetWorkouts: unknown;
  parquetWorkoutsPromise: unknown;
};

type ParquetSchemaConstructor = new (schema: Record<string, unknown>) => unknown;
type ParquetWriter = {
  appendRow: (row: Record<string, unknown>) => Promise<void>;
  close: () => Promise<void>;
};
type ParquetWriterFactory = {
  openFile: (schema: unknown, filePath: string) => Promise<ParquetWriter>;
};
type ParquetModule = {
  ParquetSchema: ParquetSchemaConstructor;
  ParquetWriter: ParquetWriterFactory;
};

const clearGlobalDbState = (): void => {
  const globalForDb = globalThis as GlobalDbState;
  globalForDb.db = undefined;
  globalForDb.dbPool = undefined;
  globalForDb.dbDataSource = undefined;
  globalForDb.parquetWorkouts = undefined;
  globalForDb.parquetWorkoutsPromise = undefined;
};

const writeFixture = async (filePath: string): Promise<void> => {
  const importedParquet = await import('parquetjs-lite');
  const parquet = (importedParquet.default ?? importedParquet) as unknown as ParquetModule;
  const schema = new parquet.ParquetSchema({
    id: { type: 'UTF8' },
    title: { type: 'UTF8' },
    timeCapSeconds: { type: 'INT32' },
    equipment: { type: 'UTF8' },
    data: { type: 'UTF8' },
    isPublished: { type: 'BOOLEAN' }
  });

  const writer = await parquet.ParquetWriter.openFile(schema, filePath);
  try {
    await writer.appendRow({
      id: 'w1',
      title: 'Parquet One',
      timeCapSeconds: 300,
      equipment: JSON.stringify(['barbell', 'pull-up bar']),
      data: JSON.stringify({ blocks: [{ name: 'Main', movements: [{ name: 'Thruster', reps: 30 }] }] }),
      isPublished: true
    });
    await writer.appendRow({
      id: 'w2',
      title: 'Parquet Two',
      timeCapSeconds: 600,
      equipment: JSON.stringify(['dumbbell', 'box']),
      data: JSON.stringify({ blocks: [{ name: 'Main', movements: [{ name: 'Snatch', reps: 20 }] }] }),
      isPublished: true
    });
    await writer.appendRow({
      id: 'w3',
      title: 'Draft Workout',
      timeCapSeconds: 240,
      equipment: JSON.stringify(['none']),
      data: JSON.stringify({ blocks: [{ name: 'Main', movements: [{ name: 'Burpee', reps: 10 }] }] }),
      isPublished: false
    });
  } finally {
    await writer.close();
  }
};

describe('Parquet workout data source', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDataSource = process.env.WORKOUTS_DATA_SOURCE;
  const originalParquetPath = process.env.WORKOUTS_PARQUET_PATH;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let tempDirectory = '';

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'wod-now-parquet-test-'));
    const parquetPath = path.join(tempDirectory, 'workouts.parquet');
    await writeFixture(parquetPath);

    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.WORKOUTS_DATA_SOURCE = 'parquet';
    mutableEnv.WORKOUTS_PARQUET_PATH = parquetPath;
    delete mutableEnv.DATABASE_URL;
  });

  afterEach(async () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    if (originalNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = originalNodeEnv;
    }

    if (originalDataSource === undefined) {
      delete mutableEnv.WORKOUTS_DATA_SOURCE;
    } else {
      mutableEnv.WORKOUTS_DATA_SOURCE = originalDataSource;
    }

    if (originalParquetPath === undefined) {
      delete mutableEnv.WORKOUTS_PARQUET_PATH;
    } else {
      mutableEnv.WORKOUTS_PARQUET_PATH = originalParquetPath;
    }

    if (originalDatabaseUrl === undefined) {
      delete mutableEnv.DATABASE_URL;
    } else {
      mutableEnv.DATABASE_URL = originalDatabaseUrl;
    }

    clearGlobalDbState();
    vi.restoreAllMocks();
    vi.resetModules();

    if (tempDirectory.length > 0) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it('supports count/find/findRandom/upsert without Postgres', async () => {
    const { db } = await import('../../src/lib/db.js');

    await expect(db.workout.count({ where: { isPublished: true } })).resolves.toBe(2);

    await expect(
      db.workout.findFirst({
        where: { id: 'w1', isPublished: true },
        select: { id: true, title: true }
      })
    ).resolves.toEqual({
      id: 'w1',
      title: 'Parquet One'
    });

    await expect(
      db.workout.findMany({
        where: { id: { notIn: ['w1'] }, isPublished: true },
        select: { id: true }
      })
    ).resolves.toEqual([{ id: 'w2' }]);

    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      db.workout.findRandom({
        where: {
          isPublished: true,
          timeCapSeconds: { lte: 400 },
          equipmentAll: ['barbell']
        },
        select: { id: true }
      })
    ).resolves.toEqual({ id: 'w1' });

    await expect(
      db.workout.upsert({
        where: { id: 'w4' },
        create: {
          id: 'w4',
          title: 'Inserted in Parquet Mode',
          timeCapSeconds: 420,
          equipment: JSON.stringify(['rower']),
          data: JSON.stringify({ blocks: [{ name: 'Main', movements: [{ name: 'Row', reps: 50 }] }] }),
          isPublished: true
        },
        update: {
          isPublished: true
        },
        select: { id: true, isPublished: true }
      })
    ).resolves.toEqual({
      id: 'w4',
      isPublished: true
    });

    await expect(db.workout.count({ where: { isPublished: true } })).resolves.toBe(3);
  });
});
