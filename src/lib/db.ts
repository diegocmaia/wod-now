import { Pool } from 'pg';
import path from 'node:path';

export type WorkoutRecord = {
  id: string;
  title: string;
  timeCapSeconds: number;
  equipment: string;
  data: string;
  isPublished: boolean;
};

type WorkoutSelect = Partial<Record<keyof WorkoutRecord, boolean>>;

type WorkoutWhereInput = {
  id?: string | { notIn: string[] };
  isPublished?: boolean;
  timeCapSeconds?: { lte: number };
};

type WorkoutRandomWhereInput = WorkoutWhereInput & {
  equipmentAll?: string[];
};

type WorkoutFindManyArgs = {
  where?: WorkoutWhereInput;
  select?: WorkoutSelect;
};

type WorkoutFindFirstArgs = {
  where?: WorkoutWhereInput;
  select?: WorkoutSelect;
};

type WorkoutFindRandomArgs = {
  where?: WorkoutRandomWhereInput;
  select?: WorkoutSelect;
};

type WorkoutCountArgs = {
  where?: WorkoutWhereInput;
};

type WorkoutUpsertArgs = {
  where: { id: string };
  create: WorkoutRecord;
  update: Partial<WorkoutRecord>;
  select?: WorkoutSelect;
};

type DbClient = {
  workout: {
    findMany: (args: WorkoutFindManyArgs) => Promise<WorkoutRecord[]>;
    findFirst: (args: WorkoutFindFirstArgs) => Promise<WorkoutRecord | null>;
    findRandom: (args: WorkoutFindRandomArgs) => Promise<WorkoutRecord | null>;
    count: (args: WorkoutCountArgs) => Promise<number>;
    upsert: (args: WorkoutUpsertArgs) => Promise<WorkoutRecord>;
  };
};

type DataSource = 'postgres' | 'parquet';

type GlobalWithDb = typeof globalThis & {
  db?: DbClient;
  dbPool?: Pool;
  dbDataSource?: DataSource;
  parquetWorkouts?: WorkoutRecord[];
  parquetWorkoutsPromise?: Promise<WorkoutRecord[]>;
};

const globalForDb = globalThis as GlobalWithDb;

const workoutColumns: ReadonlyArray<keyof WorkoutRecord> = [
  'id',
  'title',
  'timeCapSeconds',
  'equipment',
  'data',
  'isPublished'
];

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const resolveDataSource = (): DataSource => {
  const value = (process.env.WORKOUTS_DATA_SOURCE ?? 'postgres').trim().toLowerCase();
  if (value === 'postgres' || value.length === 0) {
    return 'postgres';
  }

  if (value === 'parquet') {
    return 'parquet';
  }

  throw new Error(`Unsupported WORKOUTS_DATA_SOURCE value: ${value}`);
};

const resolveParquetPath = (): string => {
  const configuredPath = process.env.WORKOUTS_PARQUET_PATH;
  if (!configuredPath || configuredPath.trim().length === 0) {
    return path.resolve(process.cwd(), 'data/workouts.parquet');
  }

  return path.resolve(process.cwd(), configuredPath);
};

const resolveSelect = (select?: WorkoutSelect): ReadonlyArray<keyof WorkoutRecord> => {
  if (!select) {
    return workoutColumns;
  }

  const selected = workoutColumns.filter((column) => select[column]);
  if (selected.length === 0) {
    return ['id'];
  }

  return selected;
};

const columnSql = (columns: ReadonlyArray<keyof WorkoutRecord>): string =>
  columns.map((column) => `"${column}"`).join(', ');

const buildWhereSql = (
  where: WorkoutWhereInput | undefined,
  startAt = 1
): { clause: string; values: unknown[] } => {
  if (!where) {
    return { clause: '', values: [] };
  }

  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = startAt;

  if (typeof where.id === 'string') {
    clauses.push(`"id" = $${index}`);
    values.push(where.id);
    index += 1;
  } else if (where.id?.notIn && where.id.notIn.length > 0) {
    clauses.push(`NOT ("id" = ANY($${index}::text[]))`);
    values.push(where.id.notIn);
    index += 1;
  }

  if (where.isPublished !== undefined) {
    clauses.push(`"isPublished" = $${index}`);
    values.push(where.isPublished);
    index += 1;
  }

  if (where.timeCapSeconds?.lte !== undefined) {
    clauses.push(`"timeCapSeconds" <= $${index}`);
    values.push(where.timeCapSeconds.lte);
    index += 1;
  }

  if (clauses.length === 0) {
    return { clause: '', values };
  }

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    values
  };
};

const applyEquipmentAllFilter = (
  clause: string,
  values: unknown[],
  equipmentAll?: string[]
): { clause: string; values: unknown[] } => {
  if (!equipmentAll || equipmentAll.length === 0) {
    return { clause, values };
  }

  const param = `$${values.length + 1}`;
  const equipmentClause = `
    NOT EXISTS (
      SELECT 1
      FROM unnest(${param}::text[]) AS required_item(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text("equipment"::jsonb) AS workout_item(value)
        WHERE lower(workout_item.value) = lower(required_item.value)
      )
    )
  `;

  return {
    clause: clause ? `${clause} AND ${equipmentClause}` : `WHERE ${equipmentClause}`,
    values: [...values, equipmentAll]
  };
};

const pickSelectedRecord = (
  workout: WorkoutRecord,
  columns: ReadonlyArray<keyof WorkoutRecord>
): WorkoutRecord => {
  const selected = {} as Record<keyof WorkoutRecord, WorkoutRecord[keyof WorkoutRecord]>;

  for (const column of columns) {
    selected[column] = workout[column];
  }

  return selected as WorkoutRecord;
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

const matchesWhere = (workout: WorkoutRecord, where?: WorkoutWhereInput): boolean => {
  if (!where) {
    return true;
  }

  if (typeof where.id === 'string' && workout.id !== where.id) {
    return false;
  }

  if (where.id && typeof where.id !== 'string' && where.id.notIn.length > 0) {
    if (where.id.notIn.includes(workout.id)) {
      return false;
    }
  }

  if (where.isPublished !== undefined && workout.isPublished !== where.isPublished) {
    return false;
  }

  if (
    where.timeCapSeconds?.lte !== undefined &&
    workout.timeCapSeconds > where.timeCapSeconds.lte
  ) {
    return false;
  }

  return true;
};

const matchesEquipmentAll = (workout: WorkoutRecord, equipmentAll?: string[]): boolean => {
  if (!equipmentAll || equipmentAll.length === 0) {
    return true;
  }

  const equipment = parseEquipment(workout.equipment);
  if (!equipment) {
    return false;
  }

  const equipmentSet = new Set(equipment.map((item) => item.toLowerCase()));
  return equipmentAll.every((required) => equipmentSet.has(required.toLowerCase()));
};

const createPool = (): Pool => {
  return new Pool({
    connectionString: requiredEnv('DATABASE_URL'),
    max: Number(process.env.PGPOOL_MAX ?? 20)
  });
};

const getPool = (): Pool => {
  if (!globalForDb.dbPool) {
    globalForDb.dbPool = createPool();
  }

  return globalForDb.dbPool;
};

const createPostgresDbClient = (): DbClient => ({
  workout: {
    findMany: async ({ where, select }: WorkoutFindManyArgs): Promise<WorkoutRecord[]> => {
      const columns = resolveSelect(select);
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT ${columnSql(columns)} FROM "Workout" ${whereQuery.clause}`;
      const result = await getPool().query(sql, whereQuery.values);
      return result.rows as WorkoutRecord[];
    },
    findFirst: async ({ where, select }: WorkoutFindFirstArgs): Promise<WorkoutRecord | null> => {
      const columns = resolveSelect(select);
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT ${columnSql(columns)} FROM "Workout" ${whereQuery.clause} LIMIT 1`;
      const result = await getPool().query(sql, whereQuery.values);
      return (result.rows[0] as WorkoutRecord | undefined) ?? null;
    },
    findRandom: async ({ where, select }: WorkoutFindRandomArgs): Promise<WorkoutRecord | null> => {
      const columns = resolveSelect(select);
      const whereQuery = buildWhereSql(where);
      const randomWhere = applyEquipmentAllFilter(
        whereQuery.clause,
        [...whereQuery.values],
        where?.equipmentAll
      );

      const countSql = `SELECT COUNT(*)::int AS count FROM "Workout" ${randomWhere.clause}`;
      const countResult = await getPool().query<{ count: number }>(countSql, randomWhere.values);
      const count = countResult.rows[0]?.count ?? 0;
      if (count === 0) {
        return null;
      }

      const randomOffset = Math.floor(Math.random() * count);
      const offsetParam = `$${randomWhere.values.length + 1}`;
      const sql = `SELECT ${columnSql(columns)} FROM "Workout" ${randomWhere.clause} ORDER BY "id" OFFSET ${offsetParam} LIMIT 1`;
      const result = await getPool().query(sql, [...randomWhere.values, randomOffset]);
      return (result.rows[0] as WorkoutRecord | undefined) ?? null;
    },
    count: async ({ where }: WorkoutCountArgs): Promise<number> => {
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT COUNT(*)::int AS count FROM "Workout" ${whereQuery.clause}`;
      const result = await getPool().query<{ count: number }>(sql, whereQuery.values);
      return result.rows[0]?.count ?? 0;
    },
    upsert: async ({ where, create, update, select }: WorkoutUpsertArgs): Promise<WorkoutRecord> => {
      const columns = resolveSelect(select);
      const sql = `
        INSERT INTO "Workout" ("id", "title", "timeCapSeconds", "equipment", "data", "isPublished")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("id") DO UPDATE SET
          "title" = $7,
          "timeCapSeconds" = $8,
          "equipment" = $9,
          "data" = $10,
          "isPublished" = $11
        RETURNING ${columnSql(columns)}
      `;

      const values = [
        where.id,
        create.title,
        create.timeCapSeconds,
        create.equipment,
        create.data,
        create.isPublished,
        update.title ?? create.title,
        update.timeCapSeconds ?? create.timeCapSeconds,
        update.equipment ?? create.equipment,
        update.data ?? create.data,
        update.isPublished ?? create.isPublished
      ];

      const result = await getPool().query(sql, values);
      return result.rows[0] as WorkoutRecord;
    }
  }
});

type ParquetCursor = {
  next: () => Promise<unknown>;
};

type ParquetReader = {
  getCursor: () => ParquetCursor;
  close: () => Promise<void>;
};

type ParquetModule = {
  ParquetReader: {
    openFile: (filePath: string) => Promise<ParquetReader>;
  };
};

const coerceText = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    throw new Error(`Invalid parquet row: missing "${field}"`);
  }

  return String(value);
};

const coerceJsonText = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`Invalid parquet row: unable to serialize "${field}"`);
  }

  return serialized;
};

const coerceInt = (value: unknown, field: string): number => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Invalid parquet row: "${field}" must be an integer`);
  }

  return parsed;
};

const coerceBoolean = (value: unknown, field: string): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  throw new Error(`Invalid parquet row: "${field}" must be boolean`);
};

const toWorkoutRecordFromParquet = (value: unknown): WorkoutRecord => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid parquet row payload');
  }

  const row = value as Record<string, unknown>;

  return {
    id: coerceText(row.id, 'id'),
    title: coerceText(row.title, 'title'),
    timeCapSeconds: coerceInt(row.timeCapSeconds, 'timeCapSeconds'),
    equipment: coerceJsonText(row.equipment, 'equipment'),
    data: coerceJsonText(row.data, 'data'),
    isPublished: coerceBoolean(row.isPublished, 'isPublished')
  };
};

const loadParquetWorkouts = async (): Promise<WorkoutRecord[]> => {
  const parquetPath = resolveParquetPath();
  const importedParquet = await import('parquetjs-lite');
  const parquet = (importedParquet.default ?? importedParquet) as unknown as ParquetModule;
  const reader = await parquet.ParquetReader.openFile(parquetPath);

  try {
    const cursor = reader.getCursor();
    const workouts: WorkoutRecord[] = [];
    let row = await cursor.next();

    while (row) {
      workouts.push(toWorkoutRecordFromParquet(row));
      row = await cursor.next();
    }

    return workouts;
  } finally {
    await reader.close();
  }
};

const getParquetWorkouts = async (): Promise<WorkoutRecord[]> => {
  if (globalForDb.parquetWorkouts) {
    return globalForDb.parquetWorkouts;
  }

  if (!globalForDb.parquetWorkoutsPromise) {
    globalForDb.parquetWorkoutsPromise = loadParquetWorkouts().then((workouts) => {
      globalForDb.parquetWorkouts = workouts;
      return workouts;
    });
  }

  return globalForDb.parquetWorkoutsPromise;
};

const createParquetDbClient = (): DbClient => ({
  workout: {
    findMany: async ({ where, select }: WorkoutFindManyArgs): Promise<WorkoutRecord[]> => {
      const columns = resolveSelect(select);
      const workouts = await getParquetWorkouts();

      return workouts
        .filter((workout) => matchesWhere(workout, where))
        .map((workout) => pickSelectedRecord(workout, columns));
    },
    findFirst: async ({ where, select }: WorkoutFindFirstArgs): Promise<WorkoutRecord | null> => {
      const columns = resolveSelect(select);
      const workouts = await getParquetWorkouts();
      const workout = workouts.find((candidate) => matchesWhere(candidate, where));

      if (!workout) {
        return null;
      }

      return pickSelectedRecord(workout, columns);
    },
    findRandom: async ({ where, select }: WorkoutFindRandomArgs): Promise<WorkoutRecord | null> => {
      const columns = resolveSelect(select);
      const workouts = await getParquetWorkouts();
      const filtered = workouts.filter(
        (workout) => matchesWhere(workout, where) && matchesEquipmentAll(workout, where?.equipmentAll)
      );

      if (filtered.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * filtered.length);
      const workout = filtered[randomIndex];
      if (!workout) {
        return null;
      }

      return pickSelectedRecord(workout, columns);
    },
    count: async ({ where }: WorkoutCountArgs): Promise<number> => {
      const workouts = await getParquetWorkouts();
      return workouts.filter((workout) => matchesWhere(workout, where)).length;
    },
    upsert: async ({ where, create, update, select }: WorkoutUpsertArgs): Promise<WorkoutRecord> => {
      const columns = resolveSelect(select);
      const workouts = await getParquetWorkouts();
      const existingIndex = workouts.findIndex((workout) => workout.id === where.id);
      const existing = existingIndex >= 0 ? workouts[existingIndex] : undefined;

      const merged: WorkoutRecord = {
        id: where.id,
        title: update.title ?? existing?.title ?? create.title,
        timeCapSeconds: update.timeCapSeconds ?? existing?.timeCapSeconds ?? create.timeCapSeconds,
        equipment: update.equipment ?? existing?.equipment ?? create.equipment,
        data: update.data ?? existing?.data ?? create.data,
        isPublished: update.isPublished ?? existing?.isPublished ?? create.isPublished
      };

      if (existingIndex >= 0) {
        workouts[existingIndex] = merged;
      } else {
        workouts.push(merged);
      }

      return pickSelectedRecord(merged, columns);
    }
  }
});

const createDbClient = (dataSource: DataSource): DbClient => {
  if (dataSource === 'parquet') {
    return createParquetDbClient();
  }

  return createPostgresDbClient();
};

const dataSource = resolveDataSource();
const singletonDb =
  globalForDb.db && globalForDb.dbDataSource === dataSource
    ? globalForDb.db
    : createDbClient(dataSource);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = singletonDb;
  globalForDb.dbDataSource = dataSource;
}

export const db = singletonDb;
