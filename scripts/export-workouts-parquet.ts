import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { loadDataset, toPersistedWorkout } from '../prisma/seed.js';

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

const defaultDatasetPath = path.resolve(process.cwd(), 'prisma/seed/workouts.json');
const defaultOutputPath = path.resolve(process.cwd(), 'data/workouts.parquet');

const resolvePath = (value: string | undefined, fallback: string): string => {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return path.resolve(process.cwd(), value);
};

const run = async (): Promise<void> => {
  const datasetPath = resolvePath(process.env.WORKOUTS_DATASET_PATH, defaultDatasetPath);
  const outputPath = resolvePath(process.env.WORKOUTS_PARQUET_PATH, defaultOutputPath);

  const workouts = await loadDataset(datasetPath);
  const persistedWorkouts = workouts.map((workout) => toPersistedWorkout(workout));

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

  await mkdir(path.dirname(outputPath), { recursive: true });
  const writer = await parquet.ParquetWriter.openFile(schema, outputPath);

  try {
    for (const workout of persistedWorkouts) {
      await writer.appendRow(workout);
    }
  } finally {
    await writer.close();
  }

  console.info(`[parquet] wrote ${persistedWorkouts.length} workout(s) to ${outputPath}`);
};

run().catch((error) => {
  console.error(`[parquet] export failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
